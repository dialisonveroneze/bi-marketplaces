// src/utils/security.js
const crypto = require('crypto');

/**
 * Gera a assinatura HMAC-SHA256 para a API da Shopee.
 * @param {string} partnerKey - A chave da API do parceiro.
 * @param {string} apiPath - O caminho da API (e.g., "/api/v2/shop/auth_partner").
 * @param {number} timestamp - O timestamp Unix em segundos.
 * @param {string} [accessToken] - O access_token (opcional, para Shop/Merchant APIs).
 * @param {number} [shopId] - O ID da loja (opcional, para Shop APIs).
 * @param {number} [merchantId] - O ID do comerciante (opcional, para Merchant APIs).
 * @returns {string} A assinatura em hexadecimal.
 */
function generateShopeeSignature(partnerKey, apiPath, timestamp, accessToken = '', shopId = '', merchantId = '') {
  let baseString;

  // Determinar o tipo de API e construir a string base
  if (accessToken && shopId) {
    // Para Shop APIs
    baseString = `${process.env.SHOPEE_PARTNER_ID_LIVE}${apiPath}${timestamp}${accessToken}${shopId}`;
  } else if (accessToken && merchantId) {
    // Para Merchant APIs (se você for usar)
    baseString = `${process.env.SHOPEE_PARTNER_ID_LIVE}${apiPath}${timestamp}${accessToken}${merchantId}`;
  } else {
    // Para Public APIs (como auth_partner)
    baseString = `${process.env.SHOPEE_PARTNER_ID_LIVE}${apiPath}${timestamp}`;
  }

  const hmac = crypto.createHmac('sha256', partnerKey);
  hmac.update(baseString);
  return hmac.digest('hex');
}

module.exports = {
  generateShopeeSignature,
  // Outras funções de segurança aqui (e.g., criptografia/descriptografia de tokens)
};