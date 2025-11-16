// sync-server.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Armazenamento em memória
let storage = {
  onlineUsers: [],
  chatMessages: []
};

// 🔄 Endpoint para obter usuários online
app.get('/online-users', (req, res) => {
  console.log('📤 Enviando usuários online:', storage.onlineUsers.length);
  res.json(storage.onlineUsers);
});

// 🔄 Endpoint para adicionar/atualizar usuário
app.post('/online-users', (req, res) => {
  const user = req.body;
  console.log('📥 Recebendo usuário:', user.name);
  
  // Remover usuário existente se houver
  storage.onlineUsers = storage.onlineUsers.filter(u => u.id !== user.id);
  
  // Adicionar novo usuário
  storage.onlineUsers.push({
    ...user,
    lastSeen: new Date().toISOString()
  });
  
  console.log('✅ Usuários atualizados:', storage.onlineUsers.length);
  res.json({ success: true, count: storage.onlineUsers.length });
});

// 🔄 Endpoint para obter mensagens
app.get('/chat-messages', (req, res) => {
  console.log('📤 Enviando mensagens:', storage.chatMessages.length);
  res.json(storage.chatMessages);
});

// 🔄 Endpoint para adicionar mensagem
app.post('/chat-messages', (req, res) => {
  try {
    const message = req.body;
    console.log('💬 Recebendo mensagem:', {
      user: message.userName,
      message: message.message,
      type: message.type
    });
    
    const newMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    
    storage.chatMessages.push(newMessage);
    
    // Manter apenas as últimas 100 mensagens
    if (storage.chatMessages.length > 100) {
      storage.chatMessages = storage.chatMessages.slice(-100);
    }
    
    console.log('✅ Mensagem adicionada. Total:', storage.chatMessages.length);
    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('❌ Erro ao adicionar mensagem:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🔄 Status do servidor
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    users: storage.onlineUsers.length,
    messages: storage.chatMessages.length,
    timestamp: Date.now()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔄 Servidor de sincronização rodando na porta ${PORT}`);
});