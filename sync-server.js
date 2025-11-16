// sync-server.js - OTIMIZADO PARA CONEXÃO COM FRONTEND
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// Configurações otimizadas para Render + Netlify
const RENDER_TIMEOUT = 120000; // Aumentado para 120 segundos
const KEEP_ALIVE_INTERVAL = 25000; // 25 segundos

// Configuração CORS mais permissiva para desenvolvimento
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sem origin (como mobile apps ou curl)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://essentia-community.netlify.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'https://essentia-community.netlify.app/'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('netlify')) {
      callback(null, true);
    } else {
      console.log('🔒 Origem bloqueada:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false
};

app.use(cors(corsOptions));

// Aumentar limites do payload
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware de logging melhorado
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`🌐 [${timestamp}] ${req.method} ${req.originalUrl}`, {
    origin: req.headers.origin || 'No Origin',
    'user-agent': req.headers['user-agent']?.substring(0, 80) || 'No User Agent',
    'content-type': req.headers['content-type'] || 'No Content-Type'
  });
  
  // Headers CORS em todas as respostas
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://essentia-community.netlify.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 horas
  
  next();
});

// Handler para OPTIONS (preflight) global
app.options('*', (req, res) => {
  console.log('🛫 Preflight request recebido');
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://essentia-community.netlify.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Armazenamento em memória
let storage = {
  onlineUsers: [],
  chatMessages: [],
  lastActivity: Date.now(),
  serverStartTime: new Date().toISOString()
};

// Middleware para atualizar última atividade
app.use((req, res, next) => {
  storage.lastActivity = Date.now();
  next();
});

// 🔄 Health Check super detalhado
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'healthy',
    service: 'Dr.Nutri Community API',
    timestamp: new Date().toISOString(),
    serverStartTime: storage.serverStartTime,
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
      heap: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB/${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    },
    storage: {
      onlineUsers: storage.onlineUsers.length,
      chatMessages: storage.chatMessages.length
    },
    environment: process.env.NODE_ENV || 'development',
    frontend: 'https://essentia-community.netlify.app',
    cors: {
      allowed: true,
      origins: ['https://essentia-community.netlify.app', 'localhost']
    },
    requestInfo: {
      origin: req.headers.origin,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  };
  
  console.log('❤️ Health check solicitado por:', req.headers.origin);
  res.status(200).json(healthInfo);
});

// 🔄 Endpoint de teste de conexão
app.get('/test-connection', (req, res) => {
  const testData = {
    message: '✅ Conexão estabelecida com sucesso!',
    server: 'back-dnutri-community.onrender.com',
    client: req.headers.origin || 'Unknown',
    timestamp: new Date().toISOString(),
    latency: `${Date.now() - parseInt(req.headers['x-request-time'] || Date.now())}ms`,
    status: 'active'
  };
  
  console.log('🧪 Teste de conexão bem-sucedido para:', req.headers.origin);
  res.json(testData);
});

// 🔄 Endpoint para obter usuários online
app.get('/online-users', (req, res) => {
  console.log('📤 Solicitando usuários online. Total:', storage.onlineUsers.length);
  
  // Limpar usuários inativos (mais de 10 minutos)
  const tenMinutesAgo = Date.now() - 600000;
  storage.onlineUsers = storage.onlineUsers.filter(user => {
    const lastSeen = new Date(user.lastSeen).getTime();
    return lastSeen > tenMinutesAgo;
  });
  
  console.log('📤 Enviando usuários online:', storage.onlineUsers.length);
  res.json({
    users: storage.onlineUsers,
    count: storage.onlineUsers.length,
    timestamp: new Date().toISOString()
  });
});

// 🔄 Endpoint para adicionar/atualizar usuário
app.post('/online-users', (req, res) => {
  try {
    const user = req.body;
    console.log('📥 Recebendo usuário:', { 
      name: user.name, 
      id: user.id,
      origin: req.headers.origin 
    });
    
    if (!user.id || !user.name) {
      return res.status(400).json({
        success: false,
        error: 'ID e nome do usuário são obrigatórios'
      });
    }
    
    // Remover usuário existente se houver
    storage.onlineUsers = storage.onlineUsers.filter(u => u.id !== user.id);
    
    // Adicionar novo usuário com timestamp atualizado
    const userData = {
      ...user,
      lastSeen: new Date().toISOString(),
      connectedAt: new Date().toISOString(),
      ip: req.ip
    };
    
    storage.onlineUsers.push(userData);
    
    console.log('✅ Usuário atualizado. Total online:', storage.onlineUsers.length);
    
    res.json({ 
      success: true, 
      user: userData,
      count: storage.onlineUsers.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro ao processar usuário:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 🔄 Endpoint para obter mensagens
app.get('/chat-messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  console.log('📤 Solicitando mensagens. Limit:', limit);
  
  const messages = storage.chatMessages.slice(-limit);
  
  res.json({
    messages: messages,
    count: messages.length,
    total: storage.chatMessages.length,
    timestamp: new Date().toISOString()
  });
});

// 🔄 Endpoint para adicionar mensagem
app.post('/chat-messages', (req, res) => {
  try {
    const message = req.body;
    
    if (!message.userId || !message.message) {
      return res.status(400).json({
        success: false,
        error: 'userId e message são obrigatórios'
      });
    }
    
    console.log('💬 Nova mensagem de:', {
      user: message.userName,
      message: message.message.substring(0, 100) + (message.message.length > 100 ? '...' : ''),
      origin: req.headers.origin
    });
    
    const newMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      serverReceived: new Date().toISOString(),
      origin: req.headers.origin
    };
    
    storage.chatMessages.push(newMessage);
    
    // Manter apenas as últimas 500 mensagens
    if (storage.chatMessages.length > 500) {
      storage.chatMessages = storage.chatMessages.slice(-500);
    }
    
    console.log('✅ Mensagem armazenada. Total:', storage.chatMessages.length);
    
    res.json({ 
      success: true, 
      message: newMessage,
      totalMessages: storage.chatMessages.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 🔄 Status completo do servidor
app.get('/status', (req, res) => {
  const now = Date.now();
  const activeThreshold = now - 300000; // 5 minutos
  
  const activeUsers = storage.onlineUsers.filter(user => {
    const lastSeen = new Date(user.lastSeen).getTime();
    return lastSeen > activeThreshold;
  });
  
  const statusInfo = {
    server: {
      status: 'online',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      startTime: storage.serverStartTime,
      environment: process.env.NODE_ENV || 'development'
    },
    connections: {
      totalUsers: storage.onlineUsers.length,
      activeUsers: activeUsers.length,
      totalMessages: storage.chatMessages.length,
      lastActivity: new Date(storage.lastActivity).toISOString()
    },
    deployment: {
      frontend: 'https://essentia-community.netlify.app',
      backend: 'https://back-dnutri-community.onrender.com',
      platform: 'Render.com'
    },
    cors: {
      enabled: true,
      allowedOrigins: ['https://essentia-community.netlify.app', 'localhost:*'],
      preflight: 'active'
    }
  };
  
  console.log('📊 Status solicitado por:', req.headers.origin);
  res.json(statusInfo);
});

// 🔄 Endpoint de informações da API
app.get('/api-info', (req, res) => {
  const apiInfo = {
    service: 'Dr.Nutri Community API',
    version: '2.2.0',
    status: 'operational',
    endpoints: {
      health: { method: 'GET', path: '/health', description: 'Health check detalhado' },
      test: { method: 'GET', path: '/test-connection', description: 'Teste de conexão' },
      status: { method: 'GET', path: '/status', description: 'Status do servidor' },
      onlineUsers: [
        { method: 'GET', path: '/online-users', description: 'Listar usuários online' },
        { method: 'POST', path: '/online-users', description: 'Adicionar/atualizar usuário' }
      ],
      chatMessages: [
        { method: 'GET', path: '/chat-messages', description: 'Obter mensagens' },
        { method: 'POST', path: '/chat-messages', description: 'Enviar mensagem' }
      ]
    },
    cors: {
      allowedOrigins: ['https://essentia-community.netlify.app'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    },
    frontend: 'https://essentia-community.netlify.app'
  };
  
  res.json(apiInfo);
});

// 🔄 Endpoint raiz
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Dr.Nutri Community Backend API',
    status: 'online',
    frontend: 'https://essentia-community.netlify.app',
    version: '2.2.0',
    timestamp: new Date().toISOString(),
    quickStart: {
      testConnection: '/test-connection',
      healthCheck: '/health',
      apiInfo: '/api-info',
      status: '/status'
    },
    documentation: 'Consulte /api-info para detalhes completos'
  });
});

// Middleware de erro global
app.use((error, req, res, next) => {
  console.error('💥 Erro global:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    origin: req.headers.origin,
    method: req.method
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Algo deu errado' : error.message,
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// Rota não encontrada
app.use('*', (req, res) => {
  console.log('🔍 Rota não encontrada:', req.originalUrl, 'Origin:', req.headers.origin);
  
  res.status(404).json({
    success: false,
    error: 'Endpoint não encontrado',
    requested: req.originalUrl,
    availableEndpoints: [
      '/health',
      '/test-connection',
      '/status',
      '/api-info',
      '/online-users',
      '/chat-messages'
    ],
    timestamp: new Date().toISOString()
  });
});

// Inicialização do servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(80));
  console.log('🚀 SERVIDOR DR.NUTRI COMMUNITY - CONFIGURADO');
  console.log('='.repeat(80));
  console.log(`✅ Backend:  https://back-dnutri-community.onrender.com`);
  console.log(`🎯 Frontend: https://essentia-community.netlify.app`);
  console.log(`🔢 Porta:    ${PORT}`);
  console.log(`⏱️  Timeout: ${RENDER_TIMEOUT}ms`);
  console.log(`🌐 CORS:     Configurado para Netlify`);
  console.log('='.repeat(80));
  console.log('📋 ENDPOINTS PARA TESTE:');
  console.log('   • /test-connection - Teste básico de conexão');
  console.log('   • /health          - Health check detalhado');
  console.log('   • /status          - Status completo');
  console.log('   • /api-info        - Documentação da API');
  console.log('='.repeat(80));
  console.log('🔄 Aguardando conexões do frontend...');
  console.log('='.repeat(80));
});

// Configurações otimizadas para Render
server.timeout = RENDER_TIMEOUT;
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Recebido SIGTERM, encerrando graciosamente...');
  server.close(() => {
    console.log('✅ Servidor encerrado.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 Recebido SIGINT, encerrando...');
  server.close(() => {
    console.log('✅ Servidor encerrado.');
    process.exit(0);
  });
});

// Keep-alive para manter servidor ativo
setInterval(() => {
  storage.lastActivity = Date.now();
  console.log('🫀 Keep-alive - Servidor ativo:', {
    users: storage.onlineUsers.length,
    messages: storage.chatMessages.length,
    uptime: Math.round(process.uptime()) + 's'
  });
}, KEEP_ALIVE_INTERVAL);

// Log de status a cada 2 minutos
setInterval(() => {
  const activeUsers = storage.onlineUsers.filter(user => {
    const lastSeen = new Date(user.lastSeen).getTime();
    return lastSeen > (Date.now() - 600000); // 10 minutos
  });
  
  console.log('📊 STATUS PERIÓDICO:', {
    frontend: 'essentia-community.netlify.app',
    users: {
      total: storage.onlineUsers.length,
      active: activeUsers.length
    },
    messages: storage.chatMessages.length,
    uptime: Math.round(process.uptime()) + 's',
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
  });
}, 120000);

module.exports = app;