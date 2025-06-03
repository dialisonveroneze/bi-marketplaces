// src/api/shopee/auth.js

const axios = require('axios');
const { supabase } = require('../../database');
const { generateShopeeSignature } = require('../../utils/security');

// Variáveis de ambiente devem estar configuradas no Render
const SHOPEE_AUTH_HOST = process.env.SHOPEE_API_HOST_LIVE; // Ex: https://openplatform.shopee.com.br
const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY = process.env.SHOPEE_API_KEY_LIVE;
const SHOPEE_REDIRECT_URL = process.env.SHOPEE_REDIRECT_URL; // URL de callback configurada na Shopee (ex: https://bi-marketplaces.onrender.com/auth/shopee/callback)

/**
 * Gera a URL de autorização da Shopee.
 * @returns {string} A URL de autorização.
 */
function generateAuthUrl() {
  const path = '/api/v2/shop/auth_partner';
  const timestamp = Math.floor(Date.now() / 1000); // Current timestamp in seconds

  const params = {
    partner_id: Number(SHOPEE_PARTNER_ID),
    redirect: SHOPEE_REDIRECT_URL,
    timestamp: timestamp,
    partner_key: SHOPEE_API_KEY, // Used for signature generation, not in URL directly
    path: path
  };

  const sign = generateShopeeSignature(params); // Generate signature for auth URL

  const authUrl = `${SHOPEE_AUTH_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(SHOPEE_REDIRECT_URL)}`;
  return authUrl;
}

/**
 * Obtém o access_token e refresh_token da Shopee após o callback de autorização.
 * @param {string} code O código de autorização recebido no callback.
 * @param {string} shop_id O ID da loja autorizada.
 * @param {number} clientId O ID do cliente associado à conexão.
 * @returns {object} Os tokens recebidos da Shopee.
 */
async function getAccessToken(code, shop_id, clientId) {
  const path = '/api/v2/auth/token_material'; // Endpoint para obter token material
  const timestamp = Math.floor(Date.now() / 1000);

  const baseString = `${SHOPEE_PARTNER_ID}${path}${timestamp}`; // Base string para a assinatura
  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    partner_key: SHOPEE_API_KEY,
    timestamp: timestamp,
  }, baseString);

  const url = `${SHOPEE_AUTH_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  try {
    const response = await axios.post(
      url,
      {
        code: code,
        shop_id: Number(shop_id),
        partner_id: Number(SHOPEE_PARTNER_ID),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    const { access_token, expire_in, refresh_token } = response.data.response;

    // Calcula a nova data de expiração
    const newExpiresAt = new Date(Date.now() + expire_in * 1000).toISOString();

    // Salva os tokens e a data de expiração no Supabase
    const { data, error } = await supabase
      .from('client_connections')
      .upsert({
        client_id: clientId,
        connection_name: 'shopee',
        shop_id: shop_id, // Guarda o shop_id diretamente
        access_token: access_token,
        refresh_token: refresh_token,
        access_token_expires_at: newExpiresAt, // Salva na nova coluna direta
        additional_data: {
          // Mantém outros dados no additional_data, se houver necessidade
          // ou remova se tudo for direto. Ex: { original_shop_id: shop_id }
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: ['client_id', 'connection_name', 'shop_id'] }) // Atualiza se a conexão já existir
      .select();

    if (error) {
      console.error('❌ [getAccessToken] Erro ao salvar tokens no Supabase:', error.message);
      throw error;
    }

    console.log('🎉 Tokens salvos/atualizados no Supabase:', data);
    return { access_token, refresh_token, expire_in };

  } catch (error) {
    console.error('❌ [getAccessToken] Erro ao obter tokens da Shopee:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    throw error;
  }
}

/**
 * Refresca o access_token da Shopee usando o refresh_token.
 * @param {number} connectionId O ID da conexão no Supabase.
 * @param {string} shop_id O ID da loja.
 * @param {string} refreshToken O refresh token atual.
 * @returns {string} O novo access_token.
 */
async function refreshShopeeAccessToken(connectionId, shop_id, refreshToken) {
  const path = '/api/v2/auth/access_token';
  const timestamp = Math.floor(Date.now() / 1000);

  // Para refresh_token, a baseString para assinatura é partner_id + path + timestamp
  const baseStringForRefreshSign = `${SHOPEE_PARTNER_ID}${path}${timestamp}`;
  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    partner_key: SHOPEE_API_KEY,
    timestamp: timestamp,
  }, baseStringForRefreshSign);

  const url = `${SHOPEE_AUTH_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  try {
    console.log(`🔄 [refreshShopeeAccessToken] Tentando refresh de token para Shop ID: ${shop_id} (Connection ID: ${connectionId})...`);
    const response = await axios.post(
      url,
      {
        shop_id: Number(shop_id),
        partner_id: Number(SHOPEE_PARTNER_ID),
        refresh_token: refreshToken, // Usa o refresh token fornecido
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    const { access_token: newAccessToken, expire_in, refresh_token: newRefreshToken } = response.data.response;

    // Calcula a nova data de expiração
    const newExpiresAt = new Date(Date.now() + expire_in * 1000).toISOString();

    // Atualiza a tabela client_connections com os novos tokens
    const { data, error } = await supabase
      .from('client_connections')
      .update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken, // Sempre atualiza o refresh token também, ele pode mudar
        access_token_expires_at: newExpiresAt, // SALVANDO DIRETAMENTE NA COLUNA!
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId); // Usa 'id' para mirar na conexão específica

    if (error) {
      console.error('❌ [refreshShopeeAccessToken] Erro ao atualizar Supabase com novos tokens:', error.message);
      throw error;
    }

    console.log(`✅ [refreshShopeeAccessToken] Token refrescado para Shop ID: ${shop_id}. Novo Access Token: ${newAccessToken.substring(0, 10)}...`);
    return newAccessToken;

  } catch (error) {
    console.error('❌ [refreshShopeeAccessToken] Erro ao refrescar token Shopee:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    throw error;
  }
}

module.exports = {
  generateAuthUrl,
  getAccessToken,
  refreshShopeeAccessToken,
};