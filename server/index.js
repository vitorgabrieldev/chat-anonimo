const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { 
  initializeDatabase, 
  saveMessage, 
  getRecentMessages, 
  saveUser, 
  removeUser, 
  getStats,
  cleanupOldMessages,
  getActiveUsers // importar função
} = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Armazenamento em memória para usuários ativos (apenas para sessões)
const activeUsers = new Map();

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API para obter mensagens
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await getRecentMessages(100);
    res.json(messages);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para obter usuários ativos
app.get('/api/active-users', async (req, res) => {
  try {
    const users = await getActiveUsers();
    res.json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários ativos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// Socket.io events
io.on('connection', async (socket) => {
  console.log('Novo usuário conectado:', socket.id);
  
  // Aguardar o cliente enviar seu ID persistente
  socket.on('sendPersistentId', async (data) => {
    let anonymousId;
    
        try {
      if (data.persistentId && /^\d{8,}$/.test(data.persistentId)) {
        // Usar ID persistente se válido (apenas números)
        anonymousId = data.persistentId;
        console.log('Usando ID persistente:', anonymousId);
      } else {
        // Gerar novo ID anônimo numérico
        const uniqueId = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 dígitos
        anonymousId = uniqueId;
        console.log('Gerando novo ID:', anonymousId);
      }
      
      const userData = {
        id: socket.id,
        anonymousId: anonymousId,
        connectedAt: new Date()
      };
      
      // Salvar usuário no banco
      try {
        await saveUser(userData);
        activeUsers.set(socket.id, userData);
      } catch (error) {
        console.error('Erro ao salvar usuário:', error);
      }
      
      // Enviar confirmação do ID para o cliente
      socket.emit('userIdConfirmed', { anonymousId });
      
      // Aguardar um pequeno delay para garantir que o cliente processou o ID
      setTimeout(async () => {
        // Enviar mensagem de boas-vindas
        const welcomeMessage = {
          id: uuidv4(),
          text: `${anonymousId} entrou no chat`,
          type: 'system',
          timestamp: new Date().toISOString(),
          userId: socket.id,
          anonymousId: anonymousId
        };
        
        // Salvar mensagem de boas-vindas no banco
        try {
          await saveMessage(welcomeMessage);
          io.emit('message', welcomeMessage);
        } catch (error) {
          console.error('Erro ao salvar mensagem de boas-vindas:', error);
        }
        
        // Enviar histórico de mensagens para o novo usuário
        try {
          console.log('Enviando histórico para:', anonymousId);
          const messages = await getRecentMessages(100);
          socket.emit('messageHistory', messages);
        } catch (error) {
          console.error('Erro ao buscar histórico:', error);
          socket.emit('messageHistory', []);
        }
      }, 200);
    } catch (error) {
      console.error('Erro ao processar ID persistente:', error);
      
      // Fallback: gerar ID simples
      const uniqueId = Math.floor(10000000 + Math.random() * 90000000).toString();
      const fallbackId = uniqueId;
      
      socket.emit('userIdConfirmed', { anonymousId: fallbackId });
      console.log('Usando ID de fallback:', fallbackId);
    }
  });
  
  // Configurar eventos de mensagem após confirmação do ID
  socket.on('sendMessage', async (data) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    
    const message = {
      id: uuidv4(),
      text: data.text,
      type: 'user',
      timestamp: new Date().toISOString(),
      userId: socket.id,
      anonymousId: user.anonymousId
    };
    
    // Salvar mensagem no banco
    try {
      await saveMessage(message);
      io.emit('message', message);
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
      socket.emit('error', { message: 'Erro ao enviar mensagem' });
    }
  });
  
  // Evento de digitação
  socket.on('typing', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    
    socket.broadcast.emit('userTyping', {
      anonymousId: user.anonymousId,
      isTyping: data.isTyping
    });
  });
  
  // Evento de desconexão
  socket.on('disconnect', async () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      const disconnectMessage = {
        id: uuidv4(),
        text: `${user.anonymousId} saiu do chat`,
        type: 'system',
        timestamp: new Date().toISOString(),
        userId: socket.id,
        anonymousId: user.anonymousId
      };
      
      // Salvar mensagem de desconexão no banco
      try {
        await saveMessage(disconnectMessage);
        io.emit('message', disconnectMessage);
      } catch (error) {
        console.error('Erro ao salvar mensagem de desconexão:', error);
      }
      
      // Remover usuário do banco
      try {
        await removeUser(socket.id);
        activeUsers.delete(socket.id);
      } catch (error) {
        console.error('Erro ao remover usuário:', error);
      }
    }
    
    console.log('Usuário desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

// Inicializar banco de dados e iniciar servidor
async function startServer() {
  try {
    // Inicializar banco de dados
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      console.error('❌ Falha ao inicializar banco de dados. Encerrando...');
      process.exit(1);
    }
    
    // Configurar limpeza automática de mensagens antigas (diariamente)
    setInterval(async () => {
      await cleanupOldMessages(7); // Manter apenas 7 dias
    }, 24 * 60 * 60 * 1000); // 24 horas
    
    // Iniciar servidor
    server.listen(PORT, () => {
          console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Acesse: http://localhost:${PORT}`);
    console.log(`💾 Banco de dados: SQLite`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer(); 