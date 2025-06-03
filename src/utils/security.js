// src/utils/security.js

const crypto = require('crypto');

function generateShopeeSignature(params, customBaseString = null) {
  const partner_key = params.partner_key;
  let baseString;

  if (customBaseString) {
    baseString = customBaseString;
  } else {
    // Standard signature for most Shopee API calls
    baseString = `${params.partner_id}${params.path}${params.timestamp}${params.access_token}${params.shop_id}`;
  }

  console.log('DEBUG: String to be signed (without partner_key):', baseString);

  const hmac = crypto.createHmac('sha256', partner_key);
  hmac.update(baseString);
  return hmac.digest('hex');
}

module.exports = {
  generateShopeeSignature,
};