const fetch = require('node-fetch');

async function testSync() {
  const baseUrl = 'http://localhost:3001';
  
  try {
    // Testar status
    const status = await fetch(`${baseUrl}/status`).then(r => r.json());
    console.log('🔄 Status do servidor:', status);
    
    // Testar estatísticas
    const stats = await fetch(`${baseUrl}/stats`).then(r => r.json());
    console.log('📊 Estatísticas:', stats);
    
    // Testar sincronização de usuário
    const testUser = {
      key: 'essentia_online_users',
      data: {
        data: [
          {
            id: 'test_user_1',
            name: 'Usuário Teste',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Test',
            isOnline: true,
            profileEnabled: true,
            lastSeen: new Date().toISOString()
          }
        ],
        timestamp: Date.now(),
        origin: 'test_script'
      }
    };
    
    const syncResult = await fetch(`${baseUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    }).then(r => r.json());
    
    console.log('✅ Teste de sincronização:', syncResult);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testSync();