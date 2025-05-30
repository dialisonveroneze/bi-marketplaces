// generateShopeeAuthLink.js

const crypto = require('crypto');

// (EXEMPLO FIXO) Dados — use variáveis reais se quiser.
const partner_id = 2011476;
const partner_key = '4e4b76515a5550644b4755494875614e416d7267696c706167634b6b424f5870';
const redirect_url = 'https://bi-marketplaces.onrender.com';
const path = '/api/v2/shop/auth_partner';

// Gera timestamp válido por 5 minutos
const timestamp = Math.floor(Date.now() / 1000);
const baseString = `${partner_id}${path}${timestamp}`;
const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

const authUrl = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirect_url)}`;

console.log('🔗 Link de autorização gerado:');
console.log(authUrl);