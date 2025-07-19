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
  getActiveUsers, // importar função
  User // importar modelo
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
// Map de anonymousId para socketId
const anonymousIdToSocketId = new Map();

// Listas ampliadas de adjetivos e animais para nomes fictícios
const ADJECTIVES = [
  'Feliz', 'Sábio', 'Rápido', 'Doce', 'Bravo', 'Calmo', 'Astuto', 'Leal', 'Misterioso', 'Radiante', 'Sereno', 'Ágil', 'Forte', 'Gentil', 'Veloz', 'Esperto', 'Valente', 'Sonhador', 'Criativo', 'Curioso',
  'Alegre', 'Brilhante', 'Cauteloso', 'Dedicado', 'Elegante', 'Feroz', 'Gracioso', 'Honesto', 'Imparável', 'Jovial', 'Leve', 'Magnífico', 'Nobre', 'Orgulhoso', 'Paciente', 'Quieto', 'Risonho', 'Sutil', 'Tranquilo', 'Único',
  'Vibrante', 'Xereta', 'Zeloso', 'Amável', 'Bondoso', 'Corajoso', 'Determinado', 'Eficiente', 'Fiel', 'Generoso', 'Habilidoso', 'Inventivo', 'Justo', 'Leal', 'Motivado', 'Natural', 'Observador', 'Persistente', 'Querido', 'Resiliente',
  'Sincero', 'Talentoso', 'Útil', 'Vencedor', 'Xodó', 'Zelador', 'Animado', 'Bacana', 'Cativante', 'Divertido', 'Empolgado', 'Fascinante', 'Guerreiro', 'Harmonioso', 'Iluminado', 'Jubiloso', 'Luminoso', 'Mágico', 'Notável', 'Orgulhoso'
];
const ANIMALS = [
  'Tigre', 'Lobo', 'Coruja', 'Leão', 'Raposa', 'Urso', 'Gato', 'Cervo', 'Panda', 'Águia', 'Tartaruga', 'Coelho', 'Cavalo', 'Macaco', 'Falcão', 'Baleia', 'Tucano', 'Pinguim', 'Canguru', 'Elefante',
  'Girafa', 'Hipopótamo', 'Iguana', 'Jacaré', 'Kiwi', 'Lagarto', 'Morcego', 'Naja', 'Ovelha', 'Porco', 'Quati', 'Rinoceronte', 'Sapo', 'Tamanduá', 'Urubu', 'Vaca', 'Xaxim', 'Zebra', 'Anta', 'BichoPreguiça',
  'Camelo', 'Dromedário', 'Escorpião', 'Flamingo', 'Gambá', 'Hiena', 'Javali', 'Lagosta', 'Mico', 'Narval', 'Ornitorrinco', 'Pato', 'Quokka', 'Rena', 'Suricato', 'Tatu', 'UrsoPolar', 'Vespa', 'Xaréu', 'Zangão',
  'Alce', 'BichoPau', 'Cobra', 'Doninha', 'Enguia', 'Foca', 'Galo', 'Harpia', 'Inseto', 'Jabuti', 'Libélula', 'Marreco', 'Nandu', 'Ouriço', 'Pavão', 'QueroQuero', 'Rato', 'Siri', 'Tritão', 'Uirapuru'
];
function generateFakeName() {
  let name;
  let tries = 0;
  do {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const number = Math.floor(100 + Math.random() * 9000); // 3-4 dígitos
    name = `${adj}${animal}#${number}`;
    tries++;
    // Evita loop infinito
    if (tries > 20) break;
  } while ([...activeUsers.values()].some(u => u.anonymousId === name));
  return name;
}

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
      // Função para garantir nome único no banco
      async function getUniqueFakeName() {
        let name;
        let tries = 0;
        do {
          name = generateFakeName();
          tries++;
          const exists = await User.findOne({ where: { anonymousId: name } });
          if (!exists) break;
        } while (tries < 30);
        return name;
      }
      // Verifica se o ID enviado é válido e único
      if (data.persistentId && /^[A-Za-zÀ-ÿ]+[A-Za-zÀ-ÿ]+#\d{3,4}$/.test(data.persistentId)) {
        const exists = await User.findOne({ where: { anonymousId: data.persistentId } });
        if (!exists) {
          anonymousId = data.persistentId;
          console.log('Usando ID persistente:', anonymousId);
        } else {
          // Já existe, gerar novo
          anonymousId = await getUniqueFakeName();
          console.log('ID persistente já existe, gerando novo:', anonymousId);
          socket.emit('userIdConfirmed', { anonymousId });
        }
      } else {
        // Gerar novo nome fictício único
        anonymousId = await getUniqueFakeName();
        console.log('Gerando novo ID:', anonymousId);
        socket.emit('userIdConfirmed', { anonymousId });
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
      // socket.emit('userIdConfirmed', { anonymousId }); // Moved up
      
      // Mapear anonymousId para socketId
      anonymousIdToSocketId.set(anonymousId, socket.id);

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
      
      // Fallback: gerar nome fictício simples
      const fallbackId = generateFakeName();
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
      anonymousId: user.anonymousId,
      toAnonymousId: data.toAnonymousId || null
    };
    
    // Salvar mensagem no banco
    try {
      await saveMessage(message);
      if (data.toAnonymousId) {
        // Mensagem privada
        const destSocketId = anonymousIdToSocketId.get(data.toAnonymousId);
        if (destSocketId) {
          io.to(destSocketId).emit('message', message); // Para o destinatário
        }
        socket.emit('message', message); // Para o remetente
      } else {
        // Mensagem pública
        io.emit('message', message);
      }
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
    
    // Remover do map anonymousIdToSocketId
    if (user && user.anonymousId) {
      anonymousIdToSocketId.delete(user.anonymousId);
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