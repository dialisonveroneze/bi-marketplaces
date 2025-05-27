const crypto = require('crypto');
const pool = require('./src/db/connection');

async function generateShopeeAuthLink(clientId) {
  const { rows } = await pool.query(`
    SELECT additional_data
    FROM client_connections
    WHERE client_id = $1 AND connection_name = 'shopee'
  `, [clientId]);

  if (rows.length === 0) {
    throw new Error('Nenhuma conexão Shopee encontrada para este cliente.');
  }

  const additionalData = rows[0].additional_data;
  const partner_id = additionalData.partner_id;
  const partner_key = additionalData.partner_key;
  const redirect = 'https://bi-marketplaces.onrender.com/callback';
  const path = '/api/v2/shop/auth_partner';
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partner_id}${path}${timestamp}`;

  const sign = crypto.createHmac('sha256', partner_key)
                     .update(baseString)
                     .digest('hex');

  const authUrl = `https://partner.test-stable.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirect)}`;

  return authUrl;
}

module.exports = generateShopeeAuthLink;
