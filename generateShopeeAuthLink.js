// 📂 Nome do arquivo: generateShopeeAuthLink.js

const crypto = require('crypto');

const partner_id = 2011476;
const partner_key = '4e4b76515a5550644b4755494875614e416d7267696c706167634b6b424f5870';
const redirect_url = 'https://bi-marketplaces.onrender.com/callback';

const path = '/api/v2/shop/auth_partner';
const timestamp = Math.floor(Date.now() / 1000);
const baseString = `${partner_id}${path}${timestamp}`;
const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

const encodedRedirect = encodeURIComponent(redirect_url);

const authUrl = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&redirect=${encodedRedirect}`;

console.log('\n🔗 Link de autorização Shopee:\n');
console.log(authUrl);
console.log('\n📌 Acesse esse link para autorizar a loja.\n');
