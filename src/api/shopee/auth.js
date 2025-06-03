// src/api/shopee/auth.js
const axios = require('axios');
const { generateShopeeSignature } = require('../../utils/security');
const { upsertClientConnection } = require('../../database');

// Carrega as variáveis de ambiente com o sufixo _LIVE para o ambiente de produção
const SHOPEE_AUTH_HOST = process.env.SHOPEE_AUTH_HOST_LIVE;
const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY = process.env.SHOPEE_API_KEY_LIVE; // Sua chave API (partner_key)
const SHOPEE_REDIRECT_URL = process.env.SHOPEE_REDIRECT_URL_LIVE;


/**
 * Gera a URL de autenticação para a Shopee.
 * @returns {string} A URL de autenticação.
 */
function generateAuthUrl() {
  const path = '/api/v2/shop/auth_partner';
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp em segundos

  // CORREÇÃO: Passando um objeto com propriedades nomeadas para generateShopeeSignature
  const sign = generateShopeeSignature({
    partner_key: SHOPEE_API_KEY, // Sua chave API
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    timestamp: timestamp
  });

  const authUrl = `${SHOPEE_AUTH_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}&redirect=${SHOPEE_REDIRECT_URL}`;
  return authUrl;
}

/**
 * Troca o código de autorização por um access_token e refresh_token.
 * @param {string} code - O código de autorização recebido da Shopee.
 * @param {number} shopId - O ID da loja autorizada.
 * @param {number} clientId - O ID do cliente interno da sua aplicação.
 * @returns {Promise<Object>} Um objeto contendo access_token, refresh_token e expire_in.
 */
async function getAccessToken(code, shopId, clientId) {
  const path = '/api/v2/auth/token/get';
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp em segundos

  // CORREÇÃO: Passando um objeto com propriedades nomeadas para generateShopeeSignature
  const sign = generateShopeeSignature({
    partner_key: SHOPEE_API_KEY,
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    timestamp: timestamp
  });

  const url = `${SHOPEE_AUTH_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;
  const body = {
    code: code,
    shop_id: Number(shopId),
    partner_id: Number(SHOPEE_PARTNER_ID),
  };

  try {
    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
    });

    const { access_token, refresh_token, expire_in } = response.data;

    // Salvar/Atualizar a conexão no banco de dados
    await upsertClientConnection({
      client_id: clientId, // Use o ID do seu cliente interno
      connection_name: 'shopee',
      access_token: access_token,
      refresh_token: refresh_token,
      // Você pode adicionar additional_data com expire_in ou outros detalhes
      additional_data: {
        shop_id: shopId,
        expires_at: new Date(Date.now() + expire_in * 1000).toISOString(), // Calcula a data de expiração
      },
    });

    console.log('✅ Access Token Shopee obtido e salvo com sucesso.');
    return { access_token, refresh_token, expire_in };

  } catch (error) {
    console.error('❌ Erro ao obter access token da Shopee:', error.response ? error.response.data : error.message);
    throw new Error('Falha ao obter access token da Shopee.');
  }
}

/**
 * Renova um access_token usando o refresh_token.
 * @param {string} refreshToken - O refresh_token atual.
 * @param {number} shopId - O ID da loja.
 * @param {number} clientId - O ID do cliente interno da sua aplicação.
 * @returns {Promise<Object>} Um objeto contendo o novo access_token, refresh_token e expire_in.
 */
async function refreshAccessToken(refreshToken, shopId, clientId) {
  const path = '/api/v2/auth/access_token/get'; // Note o path diferente
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp em segundos

  // CORREÇÃO: Passando um objeto com propriedades nomeadas para generateShopeeSignature
  const sign = generateShopeeSignature({
    partner_key: SHOPEE_API_KEY,
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    timestamp: timestamp
  });

  const url = `${SHOPEE_AUTH_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;
  const body = {
    refresh_token: refreshToken,
    partner_id: Number(SHOPEE_PARTNER_ID),
    shop_id: Number(shopId),
  };

  try {
    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
    });

    const { access_token, refresh_token: newRefreshToken, expire_in } = response.data;

    // Atualizar a conexão no banco de dados com o novo token
    await upsertClientConnection({
      client_id: clientId,
      connection_name: 'shopee',
      access_token: access_token,
      refresh_token: newRefreshToken,
      additional_data: {
        shop_id: shopId,
        expires_at: new Date(Date.now() + expire_in * 1000).toISOString(),
      },
    });

    console.log('✅ Access Token Shopee renovado e salvo com sucesso.');
    return { access_token, refresh_token: newRefreshToken, expire_in };

  } catch (error) {
    console.error('❌ Erro ao renovar access token da Shopee:', error.response ? error.response.data : error.message);
    throw new Error('Falha ao renovar access token da Shopee.');
  }
}

module.exports = {
  generateAuthUrl,
  getAccessToken,
  refreshAccessToken,
};