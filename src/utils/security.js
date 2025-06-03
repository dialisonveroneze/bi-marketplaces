// src/utils/security.js

const crypto = require('crypto');

/**
 * Gera a assinatura (sign) necessária para as requisições da API Shopee.
 * @param {object} params - Objeto contendo os parâmetros necessários para a assinatura.
 * @param {string} params.partner_id - ID do parceiro.
 * @param {string} params.path - Caminho da API (ex: /api/v2/order/get_order_list).
 * @param {number} params.timestamp - Timestamp atual em segundos.
 * @param {string} params.partner_key - Chave da API do parceiro.
 * @param {string} [params.access_token] - Access token (opcional, dependendo do endpoint).
 * @param {string} [params.shop_id] - ID da loja (opcional, dependendo do endpoint).
 * @param {string} [customBaseString] - String base customizada para a assinatura (usada para o refresh_token).
 * @returns {string} A assinatura gerada em formato hexadecimal.
 */
function generateShopeeSignature(params, customBaseString = null) {
  const partner_key = params.partner_key;
  let baseString;

  if (customBaseString) {
    baseString = customBaseString;
  } else {
    // Assinatura padrão para a maioria das chamadas da API Shopee
    // Garante que todos os campos necessários estejam presentes para evitar 'undefined' na string
    const accessTokenPart = params.access_token ? params.access_token : '';
    const shopIdPart = params.shop_id ? params.shop_id : '';
    baseString = `${params.partner_id}${params.path}${params.timestamp}${accessTokenPart}${shopIdPart}`;
  }

  console.log('DEBUG: String a ser assinada (sem partner_key):', baseString);

  const hmac = crypto.createHmac('sha256', partner_key);
  hmac.update(baseString);
  return hmac.digest('hex');
}

module.exports = {
  generateShopeeSignature,
};