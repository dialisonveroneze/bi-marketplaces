// testSupabaseClient.js
const { createClient } = require('@supabase/supabase-js');

// Variáveis de ambiente para teste local
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  try {
    console.log('🔍 Testando conexão com Supabase...');

    const { data, error } = await supabase
      .from('client_connections')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Erro ao consultar Supabase:', error.message);
    } else {
      console.log('✅ Supabase conectado e tabela encontrada!');
      console.log('📦 Dados:', data);
    }
  } catch (err) {
    console.error('❌ Erro geral:', err.message);
  }
})();