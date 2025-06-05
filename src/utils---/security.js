// src/utils/security.js

const crypto = require('crypto');

function generateShopeeSignature(params, customBaseString = null) {
  const partner_key = params.partner_key;
  let baseString;

  if (customBaseString) {
    baseString = customBaseString;
  } else {
    // Assinatura padrão para a maioria das chamadas da API Shopee
    // Este bloco provavelmente não será usado após as últimas mudanças onde customBaseString é sempre passado.
    // Mantenha por segurança, mas o foco estará nas chamadas que passam customBaseString.
    baseString = `${params.partner_id}${params.path}${params.timestamp}${params.access_token}${params.shop_id}`;
  }

  console.log('DEBUG: String a ser assinada (sem partner_key):', baseString);

  const hmac = crypto.createHmac('sha256', partner_key);
  hmac.update(baseString);
  return hmac.digest('hex');
}

module.exports = {
  generateShopeeSignature,
};