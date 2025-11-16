// sync-server.js - CONFIGURADO PARA NETLIFY
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// Configurações para deploy no Render
const RENDER_TIMEOUT = 60000; // 60 segundos para o Render inicializar
const KEEP_ALIVE_INTERVAL = 30000; // 30 segundos para manter ativo

// Configuração CORS específica para o Netlify
const corsOptions = {
  origin: [
    'https://essentia-community.netlify.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logging detalhado
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent']?.substring(0, 50)
  });
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

// 🔄 Health Check otimizado para Netlify + Render
app.get('/health', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
  res.status(200).json({
    status: 'healthy',
    service: 'Dr.Nutri Community API',
    frontend: 'https://essentia-community.netlify.app',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
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
  
  res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
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
  
  res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
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
  
  res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
  res.json(messages);
});

// 🔄 Endpoint para adicionar mensagem
app.post('/chat-messages', (req, res) => {
  try {
    const message = req.body;
    console.log('💬 Recebendo mensagem:', {
      user: message.userName,
      message: message.message.substring(0, 50) + '...',
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
    
    res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
    res.json({ 
      success: true, 
      message: newMessage,
      totalMessages: storage.chatMessages.length
    });
  } catch (error) {
    console.error('❌ Erro ao adicionar mensagem:', error);
    
    res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
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
  
  res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
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
    environment: process.env.NODE_ENV || 'development',
    frontend: 'https://essentia-community.netlify.app',
    backend: 'https://back-dnutri-community.onrender.com',
    cors: {
      allowedOrigin: 'https://essentia-community.netlify.app',
      status: 'configured'
    }
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
  
  res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
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

// 🔄 Endpoint de informações da API
app.get('/api-info', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
  res.json({
    service: 'Dr.Nutri Community Sync Server',
    version: '2.1.0',
    status: 'online',
    frontend: 'https://essentia-community.netlify.app',
    cors: {
      allowedOrigin: 'https://essentia-community.netlify.app',
      status: 'active'
    },
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
      maintenance: '/cleanup (DELETE)',
      info: '/api-info'
    },
    deployment: {
      platform: 'Render.com',
      url: 'https://back-dnutri-community.onrender.com'
    }
  });
});

// 🔄 Endpoint raiz com redirecionamento
app.get('/', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
  res.json({
    message: '🚀 Dr.Nutri Community API está funcionando!',
    frontend: 'https://essentia-community.netlify.app',
    documentation: 'Visite /api-info para detalhes completos',
    quickLinks: {
      health: '/health',
      status: '/status',
      apiInfo: '/api-info'
    },
    timestamp: new Date().toISOString()
  });
});

// Handler para OPTIONS (preflight requests)
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Tratamento de erros global
app.use((error, req, res, next) => {
  console.error('❌ Erro global:', error);
  res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: error.message,
    timestamp: new Date().toISOString(),
    frontend: 'https://essentia-community.netlify.app'
  });
});

// Rota não encontrada
app.use('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    requested: req.originalUrl,
    availableEndpoints: [
      '/health',
      '/status', 
      '/online-users',
      '/chat-messages',
      '/api-info',
      '/cleanup'
    ],
    frontend: 'https://essentia-community.netlify.app',
    timestamp: new Date().toISOString()
  });
});

// Inicialização do servidor com configurações otimizadas
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(70));
  console.log('🔄 Servidor Dr.Nutri Community - CONFIGURADO PARA NETLIFY');
  console.log('='.repeat(70));
  console.log(`✅ Backend URL: https://back-dnutri-community.onrender.com`);
  console.log(`🎯 Frontend URL: https://essentia-community.netlify.app`);
  console.log(`🔢 Porta: ${PORT}`);
  console.log(`🌐 CORS: Configurado para essentia-community.netlify.app`);
  console.log(`⏱️  Timeout: ${RENDER_TIMEOUT}ms`);
  console.log('='.repeat(70));
  console.log('📋 Endpoints principais:');
  console.log('   • /health     - Status do servidor');
  console.log('   • /status     - Estatísticas completas');
  console.log('   • /api-info   - Informações da API');
  console.log('   • /online-users - Gerenciar usuários');
  console.log('   • /chat-messages - Gerenciar mensagens');
  console.log('='.repeat(70));
  console.log('🚀 Pronto para receber requisições do Netlify!');
  console.log('='.repeat(70));
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
  console.log('🫀 Keep-alive: Servidor ativo - Pronto para Netlify');
}, KEEP_ALIVE_INTERVAL);

// Log de status periódico
setInterval(() => {
  const activeUsers = storage.onlineUsers.filter(user => {
    const lastSeen = new Date(user.lastSeen).getTime();
    return lastSeen > (Date.now() - 300000); // 5 minutos
  });
  
  console.log('📊 Status Netlify:', {
    frontend: 'essentia-community.netlify.app',
    users: {
      total: storage.onlineUsers.length,
      active: activeUsers.length
    },
    messages: storage.chatMessages.length,
    uptime: Math.round(process.uptime()) + 's'
  });
}, 60000); // A cada 1 minuto

module.exports = app;