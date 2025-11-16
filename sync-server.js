// sync-server.js - DEPLOY RENDER COM TIMEOUTS AUMENTADOS
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// Configurações para deploy no Render
const RENDER_TIMEOUT = 60000; // 60 segundos para o Render inicializar
const KEEP_ALIVE_INTERVAL = 30000; // 30 segundos para manter ativo

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Armazenamento em memória
let storage = {
  onlineUsers: [],
  chatMessages: [],
  lastActivity: Date.now()
};

// Middleware para atualizar última atividade
app.use((req, res, next) => {
  storage.lastActivity = Date.now();
  next();
});

// 🔄 Health Check melhorado para Render
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    users: storage.onlineUsers.length,
    messages: storage.chatMessages.length,
    lastActivity: new Date(storage.lastActivity).toISOString()
  });
});

// 🔄 Endpoint para obter usuários online
app.get('/online-users', (req, res) => {
  console.log('📤 Enviando usuários online:', storage.onlineUsers.length);
  
  // Limpar usuários inativos (mais de 5 minutos)
  const fiveMinutesAgo = Date.now() - 300000;
  storage.onlineUsers = storage.onlineUsers.filter(user => {
    const lastSeen = new Date(user.lastSeen).getTime();
    return lastSeen > fiveMinutesAgo;
  });
  
  res.json(storage.onlineUsers);
});

// 🔄 Endpoint para adicionar/atualizar usuário
app.post('/online-users', (req, res) => {
  const user = req.body;
  console.log('📥 Recebendo usuário:', user.name);
  
  // Remover usuário existente se houver
  storage.onlineUsers = storage.onlineUsers.filter(u => u.id !== user.id);
  
  // Adicionar novo usuário com timestamp atualizado
  storage.onlineUsers.push({
    ...user,
    lastSeen: new Date().toISOString(),
    connectedAt: new Date().toISOString()
  });
  
  console.log('✅ Usuários atualizados:', storage.onlineUsers.length);
  res.json({ 
    success: true, 
    count: storage.onlineUsers.length,
    timestamp: new Date().toISOString()
  });
});

// 🔄 Endpoint para obter mensagens
app.get('/chat-messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  console.log('📤 Enviando mensagens:', storage.chatMessages.length);
  
  const messages = storage.chatMessages.slice(-limit);
  res.json(messages);
});

// 🔄 Endpoint para adicionar mensagem
app.post('/chat-messages', (req, res) => {
  try {
    const message = req.body;
    console.log('💬 Recebendo mensagem:', {
      user: message.userName,
      message: message.message.substring(0, 50) + '...', // Log parcial
      type: message.type
    });
    
    const newMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      serverReceived: new Date().toISOString()
    };
    
    storage.chatMessages.push(newMessage);
    
    // Manter apenas as últimas 200 mensagens para economizar memória
    if (storage.chatMessages.length > 200) {
      storage.chatMessages = storage.chatMessages.slice(-200);
    }
    
    console.log('✅ Mensagem adicionada. Total:', storage.chatMessages.length);
    res.json({ 
      success: true, 
      message: newMessage,
      totalMessages: storage.chatMessages.length
    });
  } catch (error) {
    console.error('❌ Erro ao adicionar mensagem:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 🔄 Status do servidor expandido
app.get('/status', (req, res) => {
  const now = Date.now();
  const fiveMinutesAgo = now - 300000;
  
  const activeUsers = storage.onlineUsers.filter(user => {
    const lastSeen = new Date(user.lastSeen).getTime();
    return lastSeen > fiveMinutesAgo;
  });
  
  res.json({
    status: 'online',
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    users: {
      total: storage.onlineUsers.length,
      active: activeUsers.length,
      activeUsers: activeUsers.map(u => ({ id: u.id, name: u.name }))
    },
    messages: storage.chatMessages.length,
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    lastActivity: new Date(storage.lastActivity).toISOString(),
    inactiveFor: Math.round((now - storage.lastActivity) / 1000) + 's'
  });
});

// 🔄 Endpoint para limpar dados antigos (manutenção)
app.delete('/cleanup', (req, res) => {
  const initialUsers = storage.onlineUsers.length;
  const initialMessages = storage.chatMessages.length;
  
  // Limpar usuários inativos (mais de 30 minutos)
  const thirtyMinutesAgo = Date.now() - 1800000;
  storage.onlineUsers = storage.onlineUsers.filter(user => {
    const lastSeen = new Date(user.lastSeen).getTime();
    return lastSeen > thirtyMinutesAgo;
  });
  
  // Manter apenas últimas 150 mensagens
  if (storage.chatMessages.length > 150) {
    storage.chatMessages = storage.chatMessages.slice(-150);
  }
  
  res.json({
    success: true,
    users: {
      before: initialUsers,
      after: storage.onlineUsers.length,
      removed: initialUsers - storage.onlineUsers.length
    },
    messages: {
      before: initialMessages,
      after: storage.chatMessages.length,
      removed: initialMessages - storage.chatMessages.length
    },
    timestamp: new Date().toISOString()
  });
});

// 🔄 Endpoint raiz com informações
app.get('/', (req, res) => {
  res.json({
    service: 'Dr.Nutri Community Sync Server',
    version: '2.0.0',
    status: 'online',
    endpoints: {
      health: '/health',
      status: '/status',
      onlineUsers: {
        get: '/online-users',
        post: '/online-users'
      },
      chatMessages: {
        get: '/chat-messages',
        post: '/chat-messages'
      },
      maintenance: '/cleanup (DELETE)'
    },
    deployment: 'Render.com',
    documentation: 'https://back-dnutri-community.onrender.com/status'
  });
});

// Tratamento de erros global
app.use((error, req, res, next) => {
  console.error('❌ Erro global:', error);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// Rota não encontrada
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    requested: req.originalUrl,
    availableEndpoints: [
      '/health',
      '/status', 
      '/online-users',
      '/chat-messages',
      '/cleanup'
    ],
    timestamp: new Date().toISOString()
  });
});

// Inicialização do servidor com configurações otimizadas
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('🔄 Servidor de sincronização Dr.Nutri - DEPLOY RENDER');
  console.log('='.repeat(60));
  console.log(`✅ Servidor rodando na porta: ${PORT}`);
  console.log(`🌐 URL: https://back-dnutri-community.onrender.com`);
  console.log(`⏱️  Timeout configurado: ${RENDER_TIMEOUT}ms`);
  console.log(`❤️  Health Check: /health`);
  console.log(`📊 Status: /status`);
  console.log('='.repeat(60));
  console.log('⏰ Inicializando... O Render pode levar até 50s na primeira requisição.');
  console.log('='.repeat(60));
});

// Configurações de timeout para o Render
server.timeout = RENDER_TIMEOUT;
server.keepAliveTimeout = 120000; // 120 segundos
server.headersTimeout = 120000; // 120 segundos

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Recebido SIGTERM, encerrando servidor graciosamente...');
  server.close(() => {
    console.log('✅ Servidor encerrado.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 Recebido SIGINT, encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado.');
    process.exit(0);
  });
});

// Manter o servidor ativo (prevenir sleep no Render)
setInterval(() => {
  storage.lastActivity = Date.now();
  console.log('🫀 Keep-alive: Servidor ativo - Última atividade:', new Date().toISOString());
}, KEEP_ALIVE_INTERVAL);

// Log de status periódico
setInterval(() => {
  const activeUsers = storage.onlineUsers.filter(user => {
    const lastSeen = new Date(user.lastSeen).getTime();
    return lastSeen > (Date.now() - 300000); // 5 minutos
  });
  
  console.log('📊 Status periódico:', {
    users: {
      total: storage.onlineUsers.length,
      active: activeUsers.length
    },
    messages: storage.chatMessages.length,
    uptime: Math.round(process.uptime()) + 's',
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
  });
}, 60000); // A cada 1 minuto

module.exports = app;