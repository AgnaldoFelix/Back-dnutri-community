// sync-server.js - CORRIGIDO PARA NETLIFY + RENDER
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// Configurações otimizadas para Render + Netlify
const RENDER_TIMEOUT = 120000;
const KEEP_ALIVE_INTERVAL = 25000;

// Configuração CORS simplificada e eficaz
const corsOptions = {
  origin: [
    'https://essentia-community.netlify.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging melhorado
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`🌐 [${timestamp}] ${req.method} ${req.originalUrl}`, {
    origin: req.headers.origin || 'No Origin',
    ip: req.ip
  });
  next();
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

// 🔄 Health Check otimizado
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'healthy',
    service: 'Dr.Nutri Community API',
    timestamp: new Date().toISOString(),
    serverStartTime: storage.serverStartTime,
    uptime: process.uptime(),
    storage: {
      onlineUsers: storage.onlineUsers.length,
      chatMessages: storage.chatMessages.length
    },
    environment: process.env.NODE_ENV || 'development',
    frontend: 'https://essentia-community.netlify.app',
    cors: 'configured'
  };
  
  console.log('❤️ Health check de:', req.headers.origin);
  res.status(200).json(healthInfo);
});

// 🔄 Endpoint de teste de conexão simplificado
app.get('/test', (req, res) => {
  const testData = {
    message: '✅ Conexão estabelecida com sucesso!',
    server: 'back-dnutri-community.onrender.com',
    client: req.headers.origin || 'Unknown',
    timestamp: new Date().toISOString(),
    status: 'active'
  };
  
  console.log('🧪 Teste de conexão para:', req.headers.origin);
  res.json(testData);
});

// 🔄 Endpoint para obter usuários online - CORRIGIDO: RETORNA ARRAY DIRETO
app.get('/online-users', (req, res) => {
  console.log('📤 Solicitando usuários online. Total:', storage.onlineUsers.length);
  
  // Limpar usuários inativos (mais de 10 minutos)
  const tenMinutesAgo = Date.now() - 600000;
  storage.onlineUsers = storage.onlineUsers.filter(user => {
    const lastSeen = new Date(user.lastSeen).getTime();
    return lastSeen > tenMinutesAgo;
  });
  
  console.log('📤 Enviando usuários online:', storage.onlineUsers.length);
  
  // ✅ CORREÇÃO CRÍTICA: Retorna array diretamente para o .map() do frontend funcionar
  res.json(storage.onlineUsers);
});

// 🔄 Endpoint para adicionar/atualizar usuário
app.post('/online-users', (req, res) => {
  try {
    const user = req.body;
    console.log('📥 Recebendo usuário:', user.name);
    
    if (!user.id || !user.name) {
      return res.status(400).json({
        success: false,
        error: 'ID e nome do usuário são obrigatórios'
      });
    }
    
    // Remover usuário existente se houver
    storage.onlineUsers = storage.onlineUsers.filter(u => u.id !== user.id);
    
    // Adicionar novo usuário
    const userData = {
      ...user,
      lastSeen: new Date().toISOString(),
      connectedAt: new Date().toISOString()
    };
    
    storage.onlineUsers.push(userData);
    
    console.log('✅ Usuário atualizado. Total online:', storage.onlineUsers.length);
    
    res.json({ 
      success: true, 
      user: userData,
      count: storage.onlineUsers.length
    });
  } catch (error) {
    console.error('❌ Erro ao processar usuário:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// 🔄 Endpoint para obter mensagens - CORRIGIDO: RETORNA ARRAY DIRETO
app.get('/chat-messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  console.log('📤 Solicitando mensagens. Limit:', limit);
  
  const messages = storage.chatMessages.slice(-limit);
  
  // ✅ CORREÇÃO CRÍTICA: Retorna array diretamente para o .map() do frontend funcionar
  res.json(messages);
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
    
    console.log('💬 Nova mensagem de:', message.userName);
    
    const newMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      serverReceived: new Date().toISOString()
    };
    
    storage.chatMessages.push(newMessage);
    
    // Manter apenas as últimas 200 mensagens
    if (storage.chatMessages.length > 200) {
      storage.chatMessages = storage.chatMessages.slice(-200);
    }
    
    console.log('✅ Mensagem armazenada. Total:', storage.chatMessages.length);
    
    res.json({ 
      success: true, 
      message: newMessage,
      totalMessages: storage.chatMessages.length
    });
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
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
      startTime: storage.serverStartTime
    },
    connections: {
      totalUsers: storage.onlineUsers.length,
      activeUsers: activeUsers.length,
      totalMessages: storage.chatMessages.length
    },
    deployment: {
      frontend: 'https://essentia-community.netlify.app',
      backend: 'https://back-dnutri-community.onrender.com',
      platform: 'Render.com'
    },
    cors: {
      enabled: true,
      allowedOrigins: ['https://essentia-community.netlify.app']
    }
  };
  
  console.log('📊 Status solicitado por:', req.headers.origin);
  res.json(statusInfo);
});

// 🔄 Endpoint de informações da API
app.get('/api-info', (req, res) => {
  const apiInfo = {
    service: 'Dr.Nutri Community API',
    version: '2.3.0',
    status: 'operational',
    endpoints: {
      health: '/health',
      test: '/test',
      status: '/status',
      onlineUsers: {
        GET: '/online-users',
        POST: '/online-users'
      },
      chatMessages: {
        GET: '/chat-messages', 
        POST: '/chat-messages'
      }
    },
    cors: {
      allowedOrigins: ['https://essentia-community.netlify.app'],
      credentials: true
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
    version: '2.3.0',
    timestamp: new Date().toISOString(),
    quickStart: {
      test: '/test',
      health: '/health',
      apiInfo: '/api-info',
      status: '/status'
    }
  });
});

// Handler para OPTIONS (preflight)
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://essentia-community.netlify.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).send();
});

// Middleware de erro global
app.use((error, req, res, next) => {
  console.error('💥 Erro global:', error.message);
  
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: error.message
  });
});

// Rota não encontrada
app.use('*', (req, res) => {
  console.log('🔍 Rota não encontrada:', req.originalUrl);
  
  res.status(404).json({
    success: false,
    error: 'Endpoint não encontrado',
    requested: req.originalUrl,
    availableEndpoints: [
      '/health',
      '/test',
      '/status',
      '/api-info',
      '/online-users',
      '/chat-messages'
    ]
  });
});

// Inicialização do servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(70));
  console.log('🚀 SERVIDOR DR.NUTRI COMMUNITY - NETLIFY + RENDER');
  console.log('='.repeat(70));
  console.log(`✅ Backend:  https://back-dnutri-community.onrender.com`);
  console.log(`🎯 Frontend: https://essentia-community.netlify.app`);
  console.log(`🔢 Porta:    ${PORT}`);
  console.log(`⏱️  Timeout: ${RENDER_TIMEOUT}ms`);
  console.log('='.repeat(70));
  console.log('📋 ENDPOINTS PRINCIPAIS:');
  console.log('   • /test          - Teste de conexão');
  console.log('   • /health        - Health check');
  console.log('   • /online-users  - Usuários online (ARRAY)');
  console.log('   • /chat-messages - Mensagens (ARRAY)');
  console.log('='.repeat(70));
  console.log('🔄 Aguardando conexões do Netlify...');
  console.log('='.repeat(70));
});

// Configurações otimizadas para Render
server.timeout = RENDER_TIMEOUT;
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Recebido SIGTERM, encerrando...');
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
  console.log('🫀 Keep-alive - Servidor ativo');
}, KEEP_ALIVE_INTERVAL);

// Log de status a cada 2 minutos
setInterval(() => {
  const activeUsers = storage.onlineUsers.filter(user => {
    const lastSeen = new Date(user.lastSeen).getTime();
    return lastSeen > (Date.now() - 600000);
  });
  
  console.log('📊 STATUS:', {
    users: storage.onlineUsers.length,
    activeUsers: activeUsers.length,
    messages: storage.chatMessages.length,
    uptime: Math.round(process.uptime()) + 's'
  });
}, 120000);

module.exports = app;