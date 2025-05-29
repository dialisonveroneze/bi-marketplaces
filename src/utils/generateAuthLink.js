// src/utils/generateAuthLink.js
const crypto = require('crypto');
const pool = require('../db/connection');

async function generateAuthLink(clientId, marketplace = 'shopee') {
  const { rows } = await pool.query(`
    SELECT additional_data
    FROM client_connections
    WHERE client_id = $1 AND connection_name = $2
  `, [clientId, marketplace]);

  if (rows.length === 0) throw new Error(`Nenhuma conexão ${marketplace} encontrada para este cliente.`);

  const config = rows[0].additional_data;
  if (!config.env || !config[config.env]) throw new Error(`Configuração 'env' ou dados de ambiente ausentes.`);

  const { partner_id, partner_key } = config[config.env];
  const redirect = config.redirect || 'https://bi-marketplaces.onrender.com/callback';
  const path = '/api/v2/shop/auth_partner';
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partner_id}${path}${timestamp}`;
  const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

  const url = `https://partner.${config.env === 'live' ? '' : 'test-stable.'}shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirect)}`;
  return url;
}

module.exports = generateAuthLink;
