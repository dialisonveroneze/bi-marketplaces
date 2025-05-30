// generateShopeeAuthLink.js
const crypto = require('crypto');
const supabase = require('./src/utils/supabaseClient');

(async () => {
  const { data, error } = await supabase
    .from('client_connections')
    .select('*')
    .eq('connection_name', 'shopee')
    .single();

  if (error || !data) {
    console.error('❌ Erro ao buscar dados no Supabase:', error || 'Dados não encontrados');
    return;
  }

  const partner_id = data.partner_id;
  const partner_key = data.partner_key;
  const redirect_url = 'https://bi-marketplaces.onrender.com';

  const path = '/api/v2/shop/auth_partner';
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partner_id}${path}${timestamp}`;
  const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

  const authUrl = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirect_url)}`;

  console.log('\n🔗 Link de autorização Shopee:\n');
  console.log(authUrl);
})();