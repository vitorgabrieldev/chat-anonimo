// Configurações de banco de dados
// Escolha uma das opções abaixo:

// 1. SQLite (Padrão - Recomendado para MVP)
const sqliteConfig = {
  dialect: 'sqlite',
  storage: './database/chat.db',
  logging: false
};

// 2. PostgreSQL (Para produção)
const postgresConfig = {
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'chat_anonimo',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

// 3. MySQL (Alternativa)
const mysqlConfig = {
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'chat_anonimo',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

// 4. MongoDB (NoSQL - Requer mongoose)
const mongoConfig = {
  url: process.env.MONGO_URL || 'mongodb://localhost:27017/chat_anonimo',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
};

// Escolha o banco de dados baseado na variável de ambiente
const getDatabaseConfig = () => {
  const dbType = process.env.DB_TYPE || 'sqlite';
  
  switch (dbType.toLowerCase()) {
    case 'postgres':
    case 'postgresql':
      return postgresConfig;
    case 'mysql':
      return mysqlConfig;
    case 'mongo':
    case 'mongodb':
      return mongoConfig;
    case 'sqlite':
    default:
      return sqliteConfig;
  }
};

module.exports = {
  getDatabaseConfig,
  sqliteConfig,
  postgresConfig,
  mysqlConfig,
  mongoConfig
}; 