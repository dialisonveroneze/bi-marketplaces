// src/utils/security.js
const crypto = require('crypto');

/**
 * Gera a assinatura (sign) necessária para as chamadas de API da Shopee.
 * @param {Object} params - Objeto contendo os parâmetros para a assinatura.
 * @param {string} params.path - O caminho do endpoint da API (ex: '/api/v2/shop/auth_partner').
 * @param {number} params.partner_id - O ID do seu parceiro (Merchant ID ou Partner ID).
 * @param {string} params.partner_key - A chave da API do seu parceiro (Partner Key).
 * @param {number} params.timestamp - O timestamp Unix atual em segundos.
 * @returns {string} A assinatura gerada.
 */
function generateShopeeSignature({ path, partner_id, partner_key, timestamp }) {
  // --- INÍCIO DOS LOGS DE DEPURACÃO ---
  console.log('DEBUG: generateShopeeSignature - Parâmetros recebidos:');
  console.log(`- path: "${path}" (tipo: ${typeof path})`);
  console.log(`- partner_id: "${partner_id}" (tipo: ${typeof partner_id})`);
  console.log(`- partner_key: "${partner_key}" (tipo: ${typeof partner_key})`); // ESTE É O PARÂMETRO PROBLEMÁTICO
  console.log(`- timestamp: "${timestamp}" (tipo: ${typeof timestamp})`);
  // --- FIM DOS LOGS DE DEPURACÃO ---

  // Adiciona esta verificação para um erro mais específico, se o tipo estiver errado
  if (typeof partner_key !== 'string') {
    console.error('ERRO CRÍTICO: partner_key não é uma string na função generateShopeeSignature!');
    // Se este log aparecer, confirma que o tipo está errado ANTES do crypto.createHmac
    throw new TypeError(`generateShopeeSignature: O argumento "partner_key" deve ser uma string, mas recebeu um(a) ${typeof partner_key}. Valor: ${partner_key}`);
  }

  // A Shopee exige que a base da string seja montada com o partner_id, timestamp e partner_key
  // na ordem especificada e separadas por '|'
  const baseString = `${path}|${partner_id}|${timestamp}|${partner_key}`;

  console.log('DEBUG: baseString para assinatura:', baseString); // Para ver a string base completa

  // Gerar a assinatura HMAC-SHA256
  // A linha abaixo é a que estava causando o erro original quando o tipo de partner_key estava incorreto.
  const sign = crypto.createHmac('sha256', partner_key)
    .update(baseString)
    .digest('hex');

  return sign;
}

module.exports = {
  generateShopeeSignature,
};