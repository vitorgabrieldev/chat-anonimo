// Elementos do DOM
const messagesArea = document.getElementById('messages-area');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const charCount = document.getElementById('char-count');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');
const userIdDisplay = document.getElementById('user-id-display');
const copyUserIdButton = document.getElementById('copy-user-id');

// Variáveis globais
let socket;
let typingTimeout = null;
let isConnected = false;
let persistentUserId = null;
let userIdConfirmed = false;
let confirmedAnonymousId = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar e corrigir problemas do IndexedDB se necessário
  try {
    await checkAndFixIndexedDB();
  } catch (error) {
    console.warn('Erro ao verificar IndexedDB:', error);
  }
  
  loadPersistentUserId();
  initializeSocket();
  setupEventListeners();
  updateCharCount();
  
  // Se já temos um ID persistente, exibir imediatamente
  if (persistentUserId) {
    console.log('ID persistente encontrado, exibindo:', persistentUserId);
    confirmedAnonymousId = persistentUserId; // Definir o ID confirmado
    displayUserId(persistentUserId);
    // Habilitar input se já temos ID
    enableInput();
  } else {
    // Se não temos ID persistente, aguardar conexão
    console.log('Nenhum ID persistente encontrado, aguardando conexão...');
  }
});

// Função para verificar e corrigir problemas do IndexedDB
async function checkAndFixIndexedDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      resolve();
      return;
    }
    
    const request = indexedDB.open('ChatAnonymousDB', 1);
    
    request.onerror = () => {
      console.warn('Problema detectado no IndexedDB, resetando...');
      resetIndexedDB().then(resolve);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      
      // Verificar se o object store existe
      if (!db.objectStoreNames.contains('users')) {
        console.warn('Object store ausente, resetando IndexedDB...');
        db.close();
        resetIndexedDB().then(resolve);
      } else {
        console.log('IndexedDB verificado e funcionando');
        resolve();
      }
    };
  });
}

// Configuração do Socket.io
function initializeSocket() {
    socket = io();
    
        socket.on('connect', () => {
      console.log('Conectado ao servidor');
      isConnected = true;
      updateConnectionStatus(true);
      
      // Enviar ID persistente para o servidor
      socket.emit('sendPersistentId', { 
        persistentId: persistentUserId 
      });
      
      // Fallback: se não temos ID persistente, mostrar temporário
      if (!persistentUserId) {
        userIdDisplay.textContent = 'Conectando...';
        userIdDisplay.title = 'Aguardando ID do servidor';
      } else {
        // Se já temos ID persistente, habilitar input
        enableInput();
      }
    });
    
    socket.on('userIdConfirmed', (data) => {
      console.log('ID confirmado pelo servidor:', data.anonymousId);
      
      // Marcar que o ID foi confirmado
      userIdConfirmed = true;
      confirmedAnonymousId = data.anonymousId;
      
      // Salvar o ID confirmado pelo servidor
      savePersistentUserId(data.anonymousId);
      
      // Exibir ID do usuário
      displayUserId(data.anonymousId);
      
      // Habilitar input após confirmação
      enableInput();
      
      console.log('ID processado, aguardando histórico...');
    });
    
    // Fallback: se após 5 segundos não recebeu confirmação, usar socket.id
    setTimeout(() => {
      if (userIdDisplay.textContent === '---' || userIdDisplay.textContent === 'Conectando...') {
        console.log('Timeout: usando socket.id como fallback');
        displayUserId(socket.id);
        // Habilitar input no fallback
        enableInput();
      }
    }, 5000);
    
    socket.on('disconnect', () => {
        console.log('Desconectado do servidor');
        isConnected = false;
        updateConnectionStatus(false);
        disableInput();
    });
    
    socket.on('message', (message) => {
        addMessage(message);
    });
    
    socket.on('messageHistory', (messages) => {
        console.log('Histórico recebido, carregando mensagens...');
        if (userIdConfirmed) {
            console.log('ID confirmado, carregando histórico...');
            loadMessageHistory(messages);
        } else {
            console.log('ID ainda não confirmado, aguardando...');
            // Aguardar confirmação do ID antes de carregar histórico
            setTimeout(() => {
                if (userIdConfirmed) {
                    console.log('ID confirmado agora, carregando histórico...');
                    loadMessageHistory(messages);
                }
            }, 500);
        }
    });
    
    socket.on('userTyping', (data) => {
        showTypingIndicator(data);
    });
}

// Configuração dos event listeners
function setupEventListeners() {
  // Envio de mensagem
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Contador de caracteres
  messageInput.addEventListener('input', updateCharCount);
  
  // Indicador de digitação
  messageInput.addEventListener('input', handleTyping);
  
  // Botão de copiar ID
  copyUserIdButton.addEventListener('click', copyUserId);
}

// Funções de conexão
function updateConnectionStatus(connected) {
    if (connected) {
        statusIndicator.className = 'status-indicator status-online';
        statusText.textContent = 'Conectado';
    } else {
        statusIndicator.className = 'status-indicator status-offline';
        statusText.textContent = 'Desconectado';
    }
}

function enableInput() {
    console.log('Habilitando input...');
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.placeholder = 'Digite sua mensagem...';
    console.log('Input habilitado com sucesso');
    console.log('messageInput.disabled:', messageInput.disabled);
    console.log('sendButton.disabled:', sendButton.disabled);
}

function disableInput() {
    messageInput.disabled = true;
    sendButton.disabled = true;
    messageInput.placeholder = 'Conectando...';
}

// Funções de mensagem
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !isConnected) return;
    
    socket.emit('sendMessage', { text });
    messageInput.value = '';
    updateCharCount();
    handleTyping();
}

function addMessage(message) {
    // Remover mensagem de boas-vindas se existir
    const welcomeMessage = messagesArea.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    const messageElement = createMessageElement(message);
    messagesArea.appendChild(messageElement);
    scrollToBottom();
}

function createMessageElement(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${getMessageClass(message)}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  // Texto da mensagem
  const textDiv = document.createElement('div');
  textDiv.className = 'message-text';
  textDiv.textContent = message.text;
  
  // Informações (hora e usuário)
  const infoDiv = document.createElement('div');
  infoDiv.className = 'message-info';
  
  if (message.type === 'user') {
    infoDiv.textContent = `${message.anonymousId} • ${formatTime(message.timestamp)}`;
  } else if (message.type === 'system') {
    infoDiv.textContent = formatTime(message.timestamp);
  } else {
    infoDiv.textContent = formatTime(message.timestamp);
  }
  
  contentDiv.appendChild(textDiv);
  contentDiv.appendChild(infoDiv);
  messageDiv.appendChild(contentDiv);
  
  return messageDiv;
}

function getMessageClass(message) {
  if (message.type === 'system') return 'system-message';
  
  const isMyMessage = message.anonymousId === confirmedAnonymousId || message.anonymousId === persistentUserId;
  
  if (isMyMessage) {
    console.log('Mensagem identificada como minha:', message.anonymousId, 'vs', confirmedAnonymousId, 'vs', persistentUserId);
    return 'user-message';
  }
  
  console.log('Mensagem identificada como de outro usuário:', message.anonymousId);
  return 'other-message';
}

function loadMessageHistory(messages) {
  // Limpar área de mensagens
  messagesArea.innerHTML = '';
  
  // Adicionar mensagens do histórico
  messages.forEach(message => {
    addMessage(message);
  });
}

// Funções de interface
function updateCharCount() {
    const count = messageInput.value.length;
    charCount.textContent = `${count}/500`;
    
    // Mudar cor quando próximo do limite
    if (count > 450) {
        charCount.style.color = '#e53e3e';
    } else if (count > 400) {
        charCount.style.color = '#ed8936';
    } else {
        charCount.style.color = '#a0aec0';
    }
}

function handleTyping() {
    if (!isConnected) return;
    
    // Limpar timeout anterior
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    // Emitir evento de digitação
    socket.emit('typing', { isTyping: true });
    
    // Definir timeout para parar indicador de digitação
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { isTyping: false });
    }, 1000);
}

function showTypingIndicator(data) {
    if (data.isTyping) {
        typingText.textContent = `${data.anonymousId} está digitando...`;
        typingIndicator.style.display = 'flex';
        
        // Auto-hide após 3 segundos
        setTimeout(() => {
            typingIndicator.style.display = 'none';
        }, 3000);
    } else {
        typingIndicator.style.display = 'none';
    }
}

function scrollToBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
        return date.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } else {
        return date.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

// Funções de persistência
function savePersistentUserId(userId) {
  persistentUserId = userId;
  
  // 1. localStorage (mais confiável)
  try {
    localStorage.setItem('chat_anonymous_user_id', userId);
    localStorage.setItem('chat_anonymous_timestamp', Date.now().toString());
  } catch (error) {
    console.warn('localStorage não disponível:', error);
  }
  
  // 2. sessionStorage (para a sessão atual)
  try {
    sessionStorage.setItem('chat_anonymous_user_id', userId);
  } catch (error) {
    console.warn('sessionStorage não disponível:', error);
  }
  
  // 3. Cookies (máxima compatibilidade)
  try {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 10); // 10 anos
    document.cookie = `chat_anonymous_user_id=${userId}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  } catch (error) {
    console.warn('Cookies não disponíveis:', error);
  }
  
  // 4. IndexedDB (armazenamento avançado)
  saveToIndexedDB(userId);
  
  console.log('ID persistido em múltiplas camadas:', userId);
}

function loadPersistentUserId() {
  let userId = null;
  
  // 1. Tentar localStorage primeiro
  try {
    userId = localStorage.getItem('chat_anonymous_user_id');
    if (userId && userId.startsWith('Anônimo_')) {
      const timestamp = localStorage.getItem('chat_anonymous_timestamp');
      const age = Date.now() - parseInt(timestamp || '0');
      
      // Verificar se não é muito antigo (mais de 1 ano)
      if (age < 365 * 24 * 60 * 60 * 1000) {
        persistentUserId = userId;
        console.log('ID carregado do localStorage:', userId);
        return;
      } else {
        console.log('ID do localStorage muito antigo, removendo...');
        localStorage.removeItem('chat_anonymous_user_id');
        localStorage.removeItem('chat_anonymous_timestamp');
      }
    }
  } catch (error) {
    console.warn('Erro ao carregar do localStorage:', error);
  }
  
  // 2. Tentar sessionStorage
  try {
    userId = sessionStorage.getItem('chat_anonymous_user_id');
    if (userId && userId.startsWith('Anônimo_')) {
      persistentUserId = userId;
      console.log('ID carregado do sessionStorage:', userId);
      return;
    }
  } catch (error) {
    console.warn('Erro ao carregar do sessionStorage:', error);
  }
  
  // 3. Tentar cookies
  try {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'chat_anonymous_user_id' && value && value.startsWith('Anônimo_')) {
        persistentUserId = value;
        console.log('ID carregado dos cookies:', value);
        return;
      }
    }
  } catch (error) {
    console.warn('Erro ao carregar dos cookies:', error);
  }
  
  // 4. Tentar IndexedDB (assíncrono)
  loadFromIndexedDB().then(id => {
    if (id && id.startsWith('Anônimo_')) {
      persistentUserId = id;
      console.log('ID carregado do IndexedDB:', id);
      // Exibir ID se encontrado no IndexedDB
      displayUserId(id);
      // Habilitar input se encontrou ID no IndexedDB
      enableInput();
    } else {
      console.log('Nenhum ID persistido encontrado, será gerado novo');
    }
  }).catch(error => {
    console.warn('Erro ao carregar do IndexedDB:', error);
    console.log('Nenhum ID persistido encontrado, será gerado novo');
  });
  
  // Se não encontrou nada nos métodos síncronos
  if (!persistentUserId) {
    console.log('Nenhum ID persistido encontrado nos métodos síncronos');
  } else {
    // Exibir ID se encontrado nos métodos síncronos
    displayUserId(persistentUserId);
    // Habilitar input se encontrou ID nos métodos síncronos
    enableInput();
  }
}

function saveToIndexedDB(userId) {
  if (!window.indexedDB) {
    console.warn('IndexedDB não suportado');
    return;
  }
  
  const request = indexedDB.open('ChatAnonymousDB', 1);
  
  request.onerror = () => {
    console.warn('Erro ao abrir IndexedDB');
  };
  
  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('users')) {
      db.createObjectStore('users', { keyPath: 'id' });
    }
  };
  
  request.onsuccess = (event) => {
    const db = event.target.result;
    
    // Verificar se o object store existe antes de usar
    if (!db.objectStoreNames.contains('users')) {
      console.warn('Object store "users" não encontrado, criando...');
      // Tentar criar o object store
      const version = db.version + 1;
      db.close();
      const upgradeRequest = indexedDB.open('ChatAnonymousDB', version);
      
      upgradeRequest.onupgradeneeded = (event) => {
        const newDb = event.target.result;
        if (!newDb.objectStoreNames.contains('users')) {
          newDb.createObjectStore('users', { keyPath: 'id' });
        }
      };
      
      upgradeRequest.onsuccess = (event) => {
        const newDb = event.target.result;
        try {
          const transaction = newDb.transaction(['users'], 'readwrite');
          const store = transaction.objectStore('users');
          
          const saveRequest = store.put({
            id: 'current_user',
            userId: userId,
            timestamp: Date.now()
          });
          
          saveRequest.onsuccess = () => {
            console.log('ID salvo no IndexedDB (após upgrade)');
          };
          
          saveRequest.onerror = () => {
            console.warn('Erro ao salvar no IndexedDB (após upgrade)');
          };
        } catch (error) {
          console.warn('Erro ao acessar IndexedDB após upgrade:', error);
        }
      };
      
      return;
    }
    
    try {
      const transaction = db.transaction(['users'], 'readwrite');
      const store = transaction.objectStore('users');
      
      const saveRequest = store.put({
        id: 'current_user',
        userId: userId,
        timestamp: Date.now()
      });
      
      saveRequest.onsuccess = () => {
        console.log('ID salvo no IndexedDB');
      };
      
      saveRequest.onerror = () => {
        console.warn('Erro ao salvar no IndexedDB');
      };
    } catch (error) {
      console.warn('Erro ao acessar IndexedDB:', error);
    }
  };
}

function loadFromIndexedDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('IndexedDB não suportado');
      resolve(null);
      return;
    }
    
    const request = indexedDB.open('ChatAnonymousDB', 1);
    
    request.onerror = () => {
      console.warn('Erro ao abrir IndexedDB');
      resolve(null);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      
      // Verificar se o object store existe
      if (!db.objectStoreNames.contains('users')) {
        console.warn('Object store "users" não encontrado no IndexedDB');
        resolve(null);
        return;
      }
      
      try {
        const transaction = db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const getRequest = store.get('current_user');
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            const age = Date.now() - getRequest.result.timestamp;
            if (age < 365 * 24 * 60 * 60 * 1000) { // 1 ano
              console.log('ID carregado do IndexedDB:', getRequest.result.userId);
              resolve(getRequest.result.userId);
            } else {
              console.log('ID do IndexedDB expirado');
              resolve(null);
            }
          } else {
            console.log('Nenhum ID encontrado no IndexedDB');
            resolve(null);
          }
        };
        
        getRequest.onerror = () => {
          console.warn('Erro ao carregar do IndexedDB, resolvendo como null');
          resolve(null);
        };
      } catch (error) {
        console.warn('Erro ao acessar IndexedDB:', error);
        resolve(null);
      }
    };
  });
}

// Funções utilitárias
function displayUserId(userId) {
  console.log('Exibindo ID do usuário:', userId);
  
  if (!userId || !userIdDisplay) {
    console.warn('ID ou elemento de display não disponível');
    return;
  }
  
  // Mostrar apenas os primeiros 12 caracteres do ID
  const shortId = userId.substring(0, 12);
  userIdDisplay.textContent = shortId;
  userIdDisplay.title = `ID completo: ${userId}`;
  
  console.log('ID exibido com sucesso:', shortId);
}

function copyUserId() {
  const userId = persistentUserId || socket.id;
  
  // Copiar para clipboard
  navigator.clipboard.writeText(userId).then(() => {
    // Feedback visual
    const button = copyUserIdButton;
    const icon = button.querySelector('i');
    
    // Mudar ícone temporariamente
    icon.className = 'fas fa-check';
    button.classList.add('copied');
    
    // Mostrar tooltip
    button.title = 'ID copiado!';
    
    // Reverter após 2 segundos
    setTimeout(() => {
      icon.className = 'fas fa-copy';
      button.classList.remove('copied');
      button.title = 'Copiar ID';
    }, 2000);
    
    console.log('ID copiado:', userId);
  }).catch(err => {
    console.error('Erro ao copiar ID:', err);
    
    // Fallback para navegadores antigos
    const textArea = document.createElement('textarea');
    textArea.value = userId;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    // Feedback visual mesmo com fallback
    const button = copyUserIdButton;
    const icon = button.querySelector('i');
    icon.className = 'fas fa-check';
    button.classList.add('copied');
    button.title = 'ID copiado!';
    
    setTimeout(() => {
      icon.className = 'fas fa-copy';
      button.classList.remove('copied');
      button.title = 'Copiar ID';
    }, 2000);
  });
}

// Função para limpar cache (útil para resetar ID)
function clearPersistentData() {
  try {
    localStorage.removeItem('chat_anonymous_user_id');
    localStorage.removeItem('chat_anonymous_timestamp');
    sessionStorage.removeItem('chat_anonymous_user_id');
    document.cookie = 'chat_anonymous_user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    
    // Limpar IndexedDB
    if (window.indexedDB) {
      const request = indexedDB.deleteDatabase('ChatAnonymousDB');
      request.onsuccess = () => {
        console.log('IndexedDB limpo');
      };
      request.onerror = () => {
        console.warn('Erro ao limpar IndexedDB');
      };
    }
    
    persistentUserId = null;
    console.log('Todos os dados persistentes foram limpos');
  } catch (error) {
    console.error('Erro ao limpar dados persistentes:', error);
  }
}

// Função para resetar IndexedDB em caso de problemas
function resetIndexedDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      resolve();
      return;
    }
    
    console.log('Resetando IndexedDB...');
    const request = indexedDB.deleteDatabase('ChatAnonymousDB');
    
    request.onsuccess = () => {
      console.log('IndexedDB resetado com sucesso');
      resolve();
    };
    
    request.onerror = () => {
      console.warn('Erro ao resetar IndexedDB');
      resolve();
    };
  });
}

function showNotification(message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Chat Anônimo', { body: message });
  }
}

// Solicitar permissão para notificações
if ('Notification' in window) {
    Notification.requestPermission();
}

// Reconexão automática
window.addEventListener('online', () => {
    console.log('Conexão com internet restaurada');
});

window.addEventListener('offline', () => {
    console.log('Conexão com internet perdida');
    updateConnectionStatus(false);
});

// Foco automático no input
messageInput.addEventListener('focus', () => {
    if (isConnected) {
        messageInput.placeholder = 'Digite sua mensagem...';
    }
});

// Prevenção de envio de mensagens vazias
messageInput.addEventListener('input', () => {
    const hasText = messageInput.value.trim().length > 0;
    sendButton.disabled = !hasText || !isConnected;
}); 