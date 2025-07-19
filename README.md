# Chat Anônimo - MVP

Um sistema de chat anônimo em tempo real desenvolvido com Node.js, Express e Socket.io.

## 🚀 Funcionalidades

- **Chat em tempo real**: Mensagens instantâneas usando Socket.io
- **Anonimato total**: Usuários recebem IDs anônimos automáticos
- **Interface moderna**: Design responsivo e intuitivo
- **Indicador de digitação**: Mostra quando alguém está digitando
- **Histórico de mensagens**: Mantém as últimas 100 mensagens
- **Status de conexão**: Indicador visual de conectividade
- **Responsivo**: Funciona perfeitamente em desktop e mobile

## 🛠️ Tecnologias

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Banco de Dados**: SQLite (padrão), PostgreSQL, MySQL, MongoDB
- **ORM**: Sequelize
- **Dependências**: cors, uuid, sqlite3, sequelize

## 📦 Instalação

1. **Clone o repositório**
```bash
git clone <url-do-repositorio>
cd chat-anonimo
```

2. **Instale as dependências**
```bash
npm install
```

3. **Execute o servidor**
```bash
# Modo desenvolvimento (com auto-reload)
npm run dev

# Modo produção
npm start
```

4. **Acesse a aplicação**
```
http://localhost:3000
```

## 📁 Estrutura do Projeto

```
chat-anonimo/
├── server/
│   ├── index.js          # Servidor principal
│   ├── database.js       # Configuração do banco de dados
│   └── config/
│       └── database.js   # Configurações de diferentes bancos
├── public/
│   ├── index.html        # Página principal
│   ├── stats.html        # Página de estatísticas
│   ├── styles.css        # Estilos CSS
│   └── script.js         # JavaScript do frontend
├── database/             # Diretório do banco SQLite
├── package.json          # Dependências e scripts
└── README.md            # Este arquivo
```

## 🔧 Configuração

### Variáveis de Ambiente
- `PORT`: Porta do servidor (padrão: 3000)
- `DB_TYPE`: Tipo de banco de dados (sqlite, postgres, mysql, mongodb)
- `DB_HOST`: Host do banco de dados
- `DB_PORT`: Porta do banco de dados
- `DB_USER`: Usuário do banco de dados
- `DB_PASS`: Senha do banco de dados
- `DB_NAME`: Nome do banco de dados

### Configuração de Banco de Dados

#### SQLite (Padrão - Recomendado para MVP)
```bash
# Não requer configuração adicional
npm start
```

#### PostgreSQL
```bash
# Instalar dependência
npm install pg

# Configurar variáveis de ambiente
export DB_TYPE=postgres
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASS=sua_senha
export DB_NAME=chat_anonimo

npm start
```

#### MySQL
```bash
# Instalar dependência
npm install mysql2

# Configurar variáveis de ambiente
export DB_TYPE=mysql
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=root
export DB_PASS=sua_senha
export DB_NAME=chat_anonimo

npm start
```

### Personalização
- **Cores**: Edite as variáveis CSS em `public/styles.css`
- **Limite de mensagens**: Modifique o valor em `server/database.js`
- **Tamanho máximo de mensagem**: Altere o `maxlength` no HTML
- **Limpeza automática**: Configure em `server/index.js` (padrão: 7 dias)

## 🎯 Como Usar

1. **Acesse** `http://localhost:3000`
2. **Aguarde** a conexão automática
3. **Digite** sua mensagem no campo de texto
4. **Pressione Enter** ou clique no botão de enviar
5. **Veja** as mensagens aparecerem em tempo real

## 🔒 Segurança e Privacidade

- ✅ **Anonimato**: IDs gerados automaticamente
- ✅ **Persistência controlada**: Mensagens salvas com limpeza automática
- ✅ **Sem rastreamento**: Não há cookies ou identificadores pessoais
- ✅ **Conexão segura**: Suporte a HTTPS (configure SSL se necessário)
- ✅ **Limpeza automática**: Mensagens antigas removidas automaticamente

## 🚀 Deploy

### Heroku
```bash
heroku create seu-chat-anonimo
git push heroku main
```

### Vercel
```bash
vercel --prod
```

### Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🐛 Problemas Conhecidos

- Limite de 100 mensagens no histórico (configurável)
- Sem suporte a emojis personalizados
- Banco SQLite pode ficar lento com muitas mensagens (use PostgreSQL para produção)

## 🔮 Próximas Funcionalidades

- [ ] Salas de chat separadas
- [ ] Suporte a emojis
- [ ] Upload de imagens
- [ ] Moderação automática
- [ ] Notificações push
- [ ] Tema escuro/claro
- [ ] Exportação de conversas
- [ ] Filtros de mensagens
- [ ] Sistema de moderação
- [ ] Backup automático

## 📞 Suporte

Se você encontrar algum problema ou tiver sugestões, abra uma issue no repositório.

---

Desenvolvido com ❤️ por [Seu Nome] 