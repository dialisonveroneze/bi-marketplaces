// generateShopeeAuthLink.js (com Supabase)

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function generateAuthLink(client_id) {
  try {
    const { data, error } = await supabase
      .from('client_connections')
      .select('partner_id, partner_key, redirect_url')
      .eq('client_id', client_id)
      .eq('connection_name', 'shopee')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Dados não encontrados para o client_id informado.');

    const { partner_id, partner_key, redirect_url } = data;
    const path = '/api/v2/shop/auth_partner';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

    const authUrl = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirect_url)}`;

    console.log(`\n🔗 Link de autorização para o client_id ${client_id}:\n`);
    console.log(authUrl);
  } catch (err) {
    console.error('❌ Erro ao gerar link de autorização:', err.message);
  }
}

// 🧪 Execução direta via terminal (ex: node generateShopeeAuthLink.js 1)
const clientIdFromArg = process.argv[2];
if (!clientIdFromArg) {
  console.error('❌ Você precisa passar o client_id. Ex: node generateShopeeAuthLink.js 1');
  process.exit(1);
}

generateAuthLink(parseInt(clientIdFromArg));
