const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Configuração do banco SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database/chat.db'),
  logging: false, // Desabilita logs SQL no console
});

// Modelo para Mensagens
const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('user', 'system'),
    defaultValue: 'user'
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  anonymousId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false, // Desabilita createdAt e updatedAt
  indexes: [
    {
      fields: ['timestamp']
    },
    {
      fields: ['userId']
    }
  ]
});

// Modelo para Usuários (para rastrear sessões)
const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  anonymousId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  connectedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false
});

// Função para inicializar o banco
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexão com banco de dados estabelecida.');
    
    // Verificar se o banco existe
    const dbExists = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='Messages'");
    
    if (dbExists[0].length === 0) {
      // Primeira execução - criar tabelas
      await sequelize.sync({ force: true });
      console.log('✅ Tabelas criadas com sucesso.');
    } else {
      // Banco já existe - sincronizar alterações
      await sequelize.sync({ alter: true });
      console.log('✅ Modelos sincronizados com o banco de dados.');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com banco de dados:', error);
    return false;
  }
}

// Função para salvar mensagem
async function saveMessage(messageData) {
  try {
    const message = await Message.create(messageData);
    return message;
  } catch (error) {
    console.error('Erro ao salvar mensagem:', error);
    throw error;
  }
}

// Função para buscar mensagens recentes
async function getRecentMessages(limit = 100) {
  try {
    const messages = await Message.findAll({
      order: [['timestamp', 'DESC']],
      limit: limit
    });
    return messages.reverse(); // Retorna em ordem cronológica
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    return [];
  }
}

// Função para salvar/atualizar usuário
async function saveUser(userData) {
  try {
    // Se vier senha, gerar hash
    let passwordHash = undefined;
    if (userData.password) {
      // Gera hash com salt 10
      passwordHash = await bcrypt.hash(userData.password, 10);
    }

    const [user, created] = await User.findOrCreate({
      where: { id: userData.id },
      defaults: {
        ...userData,
        password: passwordHash || undefined
      }
    });

    if (!created) {
      // Atualizar lastSeen e senha se fornecida
      const updateData = { lastSeen: new Date() };
      if (passwordHash) updateData.password = passwordHash;
      await user.update(updateData);
    }

    return user;
  } catch (error) {
    console.error('Erro ao salvar usuário:', error);
    throw error;
  }
}

// Função para remover usuário
async function removeUser(userId) {
  try {
    await User.destroy({
      where: { id: userId }
    });
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
  }
}

// Função para limpar mensagens antigas (manutenção)
async function cleanupOldMessages(daysToKeep = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const deletedCount = await Message.destroy({
      where: {
        timestamp: {
          [Sequelize.Op.lt]: cutoffDate
        }
      }
    });
    
    console.log(`🧹 ${deletedCount} mensagens antigas removidas.`);
    return deletedCount;
  } catch (error) {
    console.error('Erro ao limpar mensagens antigas:', error);
    return 0;
  }
}

// Função para obter estatísticas
async function getStats() {
  try {
    const totalMessages = await Message.count();
    const totalUsers = await User.count();
    const todayMessages = await Message.count({
      where: {
        timestamp: {
          [Sequelize.Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });
    
    return {
      totalMessages,
      totalUsers,
      todayMessages
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    return { totalMessages: 0, totalUsers: 0, todayMessages: 0 };
  }
}

// Função para buscar todos os usuários ativos (todos os registros da tabela User)
async function getActiveUsers() {
  try {
    const users = await User.findAll();
    return users;
  } catch (error) {
    console.error('Erro ao buscar usuários ativos:', error);
    return [];
  }
}

module.exports = {
  sequelize,
  Message,
  User,
  initializeDatabase,
  saveMessage,
  getRecentMessages,
  saveUser,
  removeUser,
  cleanupOldMessages,
  getStats,
  getActiveUsers // exporta nova função
}; 