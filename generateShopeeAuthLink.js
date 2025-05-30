// generateShopeeAuthLink.js
require('dotenv').config();
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Configuração Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateShopeeAuthLink() {
  try {
    const { data, error } = await supabase
      .from('config_shopee')
      .select('*')
      .single();

    if (error) {
      throw new Error('Erro ao buscar configurações da Shopee: ' + error.message);
    }

    const partner_id = data.partner_id;
    const partner_key = data.partner_key;
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}/api/v2/shop/auth_partner${timestamp}`;
    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

    // 🚨 Aqui GARANTIMOS que não inclua o /callback
    const redirect = encodeURIComponent(data.redirect_uri);
    const authUrl = `https://partner.shopeemobile.com/api/v2/shop/auth_partner?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&redirect=${redirect}`;

    console.log('🔗 URL de autorização Shopee:', authUrl);
  } catch (err) {
    console.error('❌ Erro ao gerar o link de autorização:', err.message);
  }
}

generateShopeeAuthLink();