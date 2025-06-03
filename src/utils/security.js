// src/utils/security.js
const crypto = require('crypto');

/**
 * Gera a assinatura (sign) necessária para as chamadas de API da Shopee.
 * @param {Object} params - Objeto contendo os parâmetros para a assinatura.
 * @param {string} params.path - O caminho do endpoint da API (ex: '/api/v2/shop/auth_partner').
 * @param {number} params.partner_id - O ID do seu parceiro (Merchant ID ou Partner ID).
 * @param {string} params.partner_key - A chave da API do seu parceiro (Partner Key).
 * @param {number} params.timestamp - O timestamp Unix atual em segundos.
 * @param {number} [params.shop_id] - O ID da loja (opcional, necessário para APIs de loja).
 * @param {string} [params.access_token] - O access_token da loja (opcional, necessário para APIs de loja).
 * @returns {string} A assinatura gerada.
 */
function generateShopeeSignature({ path, partner_id, partner_key, timestamp, shop_id, access_token }) {
  console.log('DEBUG: generateShopeeSignature - Parâmetros recebidos:');
  console.log(`- path: "${path}" (tipo: ${typeof path})`);
  console.log(`- partner_id: "${partner_id}" (tipo: ${typeof partner_id})`);
  console.log(`- partner_key: "${partner_key}" (tipo: ${typeof partner_key})`);
  console.log(`- timestamp: "${timestamp}" (tipo: ${typeof timestamp})`);
  console.log(`- shop_id: "${shop_id}" (tipo: ${typeof shop_id})`); // Novo log
  console.log(`- access_token: "${access_token}" (tipo: ${typeof access_token})`); // Novo log

  if (typeof partner_key !== 'string') {
    console.error('ERRO CRÍTICO: partner_key não é uma string na função generateShopeeSignature!');
    throw new TypeError(`generateShopeeSignature: O argumento "partner_key" deve ser uma string, mas recebeu um(a) ${typeof partner_key}. Valor: ${partner_key}`);
  }

  // A base da string para APIs de loja precisa incluir shop_id e access_token
  // Eles devem ser adicionados na ordem correta, que geralmente é alfabética
  let baseString = `${path}|${partner_id}|${timestamp}`;

  // Se shop_id e access_token estiverem presentes, adicione-os à baseString
  // A ordem é importante, geralmente lexicográfica (alfabética) após os parâmetros básicos.
  // IMPORTANTE: A Shopee tem diferentes regras para diferentes APIs.
  // Para a maioria das APIs de loja (v2), o formato é path|partner_id|timestamp|access_token|shop_id.
  // A documentação deve ser verificada para cada endpoint.

  // Para get_order_list, a ordem na assinatura deve ser: path|partner_id|access_token|shop_id|timestamp|partner_key
  // Vamos usar a ordem que a Shopee tipicamente usa: path|partner_id|access_token|shop_id|timestamp
  // e o partner_key vai no final.
  if (access_token && shop_id) {
      baseString = `${path}|${partner_id}|${access_token}|${shop_id}|${timestamp}`;
  } else {
      // Se não tiver shop_id/access_token, volta para a baseString original (para APIs de autenticação)
      baseString = `${path}|${partner_id}|${timestamp}`;
  }

  baseString += `|${partner_key}`; // Partner key sempre vai no final da baseString

  console.log('DEBUG: baseString para assinatura (AJUSTADA):', baseString);

  const sign = crypto.createHmac('sha256', partner_key)
    .update(baseString)
    .digest('hex');

  return sign;
}

module.exports = {
  generateShopeeSignature,
};