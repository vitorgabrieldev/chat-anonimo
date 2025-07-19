#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Configurando Chat Anônimo...\n');

// Verificar se o Node.js está instalado
try {
  const nodeVersion = process.version;
  console.log(`✅ Node.js ${nodeVersion} detectado`);
} catch (error) {
  console.error('❌ Node.js não encontrado. Instale o Node.js primeiro.');
  process.exit(1);
}

// Criar diretórios necessários
const dirs = ['database', 'server/config'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Diretório criado: ${dir}`);
  }
});

// Verificar se package.json existe
if (!fs.existsSync('package.json')) {
  console.error('❌ package.json não encontrado. Execute este script na raiz do projeto.');
  process.exit(1);
}

// Instalar dependências
console.log('\n📦 Instalando dependências...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependências instaladas com sucesso!');
} catch (error) {
  console.error('❌ Erro ao instalar dependências:', error.message);
  process.exit(1);
}

// Criar arquivo .env se não existir
const envPath = '.env';
if (!fs.existsSync(envPath)) {
  const envContent = `# Configurações do Chat Anônimo
PORT=3000

# Configuração do Banco de Dados
# Opções: sqlite, postgres, mysql, mongodb
DB_TYPE=sqlite

# Configurações para PostgreSQL (opcional)
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=postgres
# DB_PASS=sua_senha
# DB_NAME=chat_anonimo

# Configurações para MySQL (opcional)
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASS=sua_senha
# DB_NAME=chat_anonimo

# Configurações para MongoDB (opcional)
# MONGO_URL=mongodb://localhost:27017/chat_anonimo
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('📝 Arquivo .env criado com configurações padrão');
}

// Verificar estrutura de arquivos
const requiredFiles = [
  'server/index.js',
  'server/database.js',
  'server/config/database.js',
  'public/index.html',
  'public/stats.html',
  'public/styles.css',
  'public/script.js'
];

console.log('\n🔍 Verificando estrutura de arquivos...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Arquivo não encontrado`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.error('\n❌ Alguns arquivos estão faltando. Verifique se todos os arquivos foram criados.');
  process.exit(1);
}

console.log('\n🎉 Configuração concluída com sucesso!');
console.log('\n📋 Próximos passos:');
console.log('1. Execute: npm start');
console.log('2. Acesse: http://localhost:3000');
console.log('3. Para ver estatísticas: http://localhost:3000/stats.html');
console.log('\n💡 Dicas:');
console.log('- Use "npm run dev" para desenvolvimento com auto-reload');
console.log('- Configure variáveis de ambiente no arquivo .env');
console.log('- Para produção, considere usar PostgreSQL ou MySQL');
console.log('\n📚 Documentação: README.md'); 