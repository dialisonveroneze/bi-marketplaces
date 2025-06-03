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

  const authUrl = `${SHOPEE_AUTH_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(SHOPEEE_REDIRECT_URL)}`;
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

  // --- NOVOS LOGS NA getAccessToken ---
  console.log('[DEBUG_AUTH] getAccessToken - Iniciando processo para Shop ID:', shop_id);
  console.log('[DEBUG_AUTH] getAccessToken - code recebido (parcial):', code ? code.substring(0, 10) + '...' : 'NULO/UNDEFINED');
  console.log('[DEBUG_AUTH] getAccessToken - partner_id:', SHOPEE_PARTNER_ID, 'path:', path, 'timestamp:', timestamp);
  // --- FIM DOS NOVOS LOGS NA getAccessToken ---

  const baseString = `${SHOPEE_PARTNER_ID}${path}${timestamp}`; // Base string para a assinatura
  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    partner_key: SHOPEE_API_KEY,
    timestamp: timestamp,
  }, baseString);

  const url = `${SHOPEE_AUTH_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  // --- NOVOS LOGS NA getAccessToken ---
  console.log('[DEBUG_AUTH] getAccessToken - URL para requisição do token:', url);
  console.log('[DEBUG_AUTH] getAccessToken - Payload da requisição:', {
    code: code ? code.substring(0, 10) + '...' : 'NULO/UNDEFINED',
    shop_id: Number(shop_id),
    partner_id: Number(SHOPEE_PARTNER_ID),
  });
  // --- FIM DOS NOVOS LOGS NA getAccessToken ---

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

    // --- NOVOS LOGS NA getAccessToken ---
    console.log('[DEBUG_AUTH] getAccessToken - Tokens recebidos da Shopee (parcial):', {
        access_token: access_token ? access_token.substring(0, 10) + '...' : 'NULO',
        refresh_token: refresh_token ? refresh_token.substring(0, 10) + '...' : 'NULO',
        expire_in: expire_in,
        newExpiresAt: newExpiresAt
    });
    // --- FIM DOS NOVOS LOGS NA getAccessToken ---

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
      // --- NOVO LOG DE ERRO DE SUPABASE ---
      console.error('[DEBUG_AUTH] getAccessToken - Detalhes do erro Supabase:', error);
      // --- FIM NOVO LOG DE ERRO DE SUPABASE ---
      throw error;
    }

    console.log('🎉 Tokens salvos/atualizados no Supabase:', data);
    return { access_token, refresh_token, expire_in };

  } catch (error) {
    console.error('❌ [getAccessToken] Erro ao obter tokens da Shopee:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    // --- NOVO LOG DE ERRO DE AXIOS ---
    if (error.response) {
      console.error('[DEBUG_AUTH] getAccessToken - Axios response error data:', error.response.data);
      console.error('[DEBUG_AUTH] getAccessToken - Axios response status:', error.response.status);
    }
    // --- FIM NOVO LOG DE ERRO DE AXIOS ---
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
  // --- INÍCIO DOS NOVOS LOGS NA refreshShopeeAccessToken ---
  console.log(`🔄 [refreshShopeeAccessToken] Iniciando processo de refresh para Shop ID: ${shop_id} (Connection ID: ${connectionId})...`);
  console.log(`[DEBUG_AUTH] refreshShopeeAccessToken - Refresh Token recebido (parcial): ${refreshToken ? refreshToken.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);
  console.log(`[DEBUG_AUTH] refreshShopeeAccessToken - Partner ID: ${SHOPEE_PARTNER_ID}, Partner Key (parcial): ${SHOPEE_API_KEY ? SHOPEE_API_KEY.substring(0, 5) + '...' : 'NULO/UNDEFINED'}`);
  // --- FIM DOS NOVOS LOGS NA refreshShopeeAccessToken ---

  const path = '/api/v2/auth/access_token';
  const timestamp = Math.floor(Date.now() / 1000);

  // Para refresh_token, a baseString para assinatura é partner_id + path + timestamp
  const baseStringForRefreshSign = `${SHOPEE_PARTNER_ID}${path}${timestamp}`;

  // --- NOVOS LOGS ANTES DA GERAÇÃO DA ASSINATURA ---
  console.log(`[DEBUG_AUTH] refreshShopeeAccessToken - Base string para assinatura: "${baseStringForRefreshSign}"`);
  console.log(`[DEBUG_AUTH] refreshShopeeAccessToken - Parâmetros para generateShopeeSignature: `, {
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    partner_key: SHOPEE_API_KEY,
    timestamp: timestamp,
  });
  // --- FIM DOS NOVOS LOGS ANTES DA GERAÇÃO DA ASSINATURA ---

  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    partner_key: SHOPEE_API_KEY,
    timestamp: timestamp,
  }, baseStringForRefreshSign);

  const url = `${SHOPEE_AUTH_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  // --- NOVOS LOGS ANTES DA REQUISIÇÃO AXIOS ---
  console.log(`[DEBUG_AUTH] refreshShopeeAccessToken - URL da requisição de refresh: ${url}`);
  console.log(`[DEBUG_AUTH] refreshShopeeAccessToken - Payload da requisição de refresh:`, {
    shop_id: Number(shop_id),
    partner_id: Number(SHOPEE_PARTNER_ID),
    refresh_token: refreshToken ? refreshToken.substring(0, 10) + '...' : 'NULO/UNDEFINED',
  });
  // --- FIM DOS NOVOS LOGS ANTES DA REQUISIÇÃO AXIOS ---

  try {
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

    // --- NOVOS LOGS DE SUCESSO DE REFRESH ---
    console.log(`✅ [refreshShopeeAccessToken] Resposta bem-sucedida da Shopee para refresh. Novos tokens (parcial):`);
    console.log(`  - newAccessToken: ${newAccessToken ? newAccessToken.substring(0, 10) + '...' : 'NULO'}`);
    console.log(`  - newRefreshToken: ${newRefreshToken ? newRefreshToken.substring(0, 10) + '...' : 'NULO'}`);
    console.log(`  - expire_in: ${expire_in} segundos`);
    console.log(`  - newExpiresAt: ${newExpiresAt}`);
    // --- FIM DOS NOVOS LOGS DE SUCESSO DE REFRESH ---

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
      // --- NOVO LOG DE ERRO DE SUPABASE ---
      console.error('[DEBUG_AUTH] refreshShopeeAccessToken - Detalhes do erro Supabase:', error);
      // --- FIM NOVO LOG DE ERRO DE SUPABASE ---
      throw error;
    }

    console.log(`✅ [refreshShopeeAccessToken] Token refrescado para Shop ID: ${shop_id}. Novo Access Token: ${newAccessToken.substring(0, 10)}...`);
    return newAccessToken;

  } catch (error) {
    console.error('❌ [refreshShopeeAccessToken] Erro ao refrescar token Shopee:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    // --- NOVO LOG DE ERRO DE AXIOS PARA REFRESH ---
    if (error.response) {
      console.error('[DEBUG_AUTH] refreshShopeeAccessToken - Axios response error data:', error.response.data);
      console.error('[DEBUG_AUTH] refreshShopeeAccessToken - Axios response status:', error.response.status);
    }
    // --- FIM NOVO LOG DE ERRO DE AXIOS PARA REFRESH ---
    throw error;
  }
}

module.exports = {
  generateAuthUrl,
  getAccessToken,
  refreshShopeeAccessToken,
};