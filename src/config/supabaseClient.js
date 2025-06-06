// src/config/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Verifica se as variáveis de ambiente estão carregadas
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERRO: Variáveis de ambiente SUPABASE_URL ou SUPABASE_ANON_KEY não configuradas.');
    // Considere sair do processo ou lançar um erro fatal em produção
} else {
    console.log('--- Conexão Supabase configurada com sucesso. ---');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;