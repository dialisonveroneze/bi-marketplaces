// src/utils/security.js
const crypto = require('crypto');

function generateShopeeSignature({ path, partner_id, partner_key, timestamp, shop_id, access_token }) {
  console.log('DEBUG: generateShopeeSignature - Parâmetros recebidos:');
  console.log(`- path: "${path}" (tipo: ${typeof path})`);
  console.log(`- partner_id: "${partner_id}" (tipo: ${typeof partner_id})`);
  console.log(`- partner_key: "${partner_key}" (tipo: ${typeof partner_key})`);
  console.log(`- timestamp: "${timestamp}" (tipo: ${typeof timestamp})`);
  console.log(`- shop_id: "${shop_id}" (tipo: ${typeof shop_id})`);
  console.log(`- access_token: "${access_token}" (tipo: ${typeof access_token})`);

  if (typeof partner_key !== 'string') {
    console.error('ERRO CRÍTICO: partner_key não é uma string na função generateShopeeSignature!');
    throw new TypeError(`generateShopeeSignature: O argumento "partner_key" deve ser uma string, mas recebeu um(a) ${typeof partner_key}. Valor: ${partner_key}`);
  }

  let stringToSign = '';

  // Para APIs de loja (com access_token e shop_id), a string a ser assinada é:
  // partner_id + path + timestamp + access_token + shop_id
  // Sem delimitadores '|' entre eles, pois a partner_key é a chave do HMAC, não parte da string a ser hashed.
  if (access_token && shop_id) {
      stringToSign = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;
  } else {
      // Para APIs de autenticação (sem access_token e shop_id), a string é:
      // partner_id + path + timestamp
      stringToSign = `${partner_id}${path}${timestamp}`;
  }

  // --- NOVO LOG DE DEPURACÃO PARA A STRING A SER ASSINADA ---
  console.log('DEBUG: String a ser assinada (sem partner_key):', stringToSign);
  // --- FIM DO NOVO LOG ---

  const sign = crypto.createHmac('sha256', partner_key) // A partner_key é a chave aqui
    .update(stringToSign) // A string a ser hashed é 'stringToSign'
    .digest('hex');

  return sign;
}

module.exports = {
  generateShopeeSignature,
};