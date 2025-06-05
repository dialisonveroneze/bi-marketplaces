// src/config/supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Erro CRÍTICO: Variáveis de ambiente do Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) não estão configuradas.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = supabase;