// src/api/shopee/auth.js
const axios = require('axios');
const { supabase } = require('../../database');
const { generateShopeeSignature } = require('../../utils/security');

// Variáveis de ambiente
// Assegure-se de que estas variáveis estão configuradas corretamente no seu ambiente (ex: Render)
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE; // Ex: https://openplatform.shopee.com.br ou https://partner.shopeemobile.com
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE;
const SHOPEE_REDIRECT_URL_LIVE = process.env.SHOPEE_REDIRECT_URL_LIVE; // A URL de redirecionamento para sua aplicação (ex: https://bi-marketplaces.onrender.com/auth/shopee/callback)

/**
 * Gera a URL de autorização da Shopee que o vendedor deve acessar.
 * Esta URL é usada para iniciar o processo de OAuth 2.0 com a Shopee.
 *
 * @returns {string} A URL de autorização completa.
 */
function generateAuthUrl() {
  const path = '/api/v2/shop/auth_partner'; // Endpoint fixo para autorização
  const timestamp = Math.floor(Date.now() / 1000); // Timestamp atual em segundos

  // A base string para a assinatura de autorização é diferente: partner_id + path + timestamp
  const baseStringForAuthSign = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}`;

  // Gera a assinatura usando o partner_key
  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID_LIVE,
    partner_key: SHOPEE_API_KEY_LIVE,
    timestamp: timestamp,
  }, baseStringForAuthSign);

  // Constrói a URL de autorização
  const authUrl = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(SHOPEE_REDIRECT_URL_LIVE)}`;

  console.log(`[AUTH_URL_GEN] URL de autorização gerada: ${authUrl}`);
  return authUrl;
}

/**
 * Realiza a primeira troca do código de autorização (obtido após o vendedor autorizar)
 * por um access_token e refresh_token da Shopee.
 *
 * @param {string} code O código de autorização único recebido no callback da Shopee.
 * @param {string} shop_id O ID da loja autorizada.
 * @param {number} clientId O ID do cliente na sua base de dados associado à conexão.
 * @returns {object} Um objeto contendo o novo access_token, refresh_token e expire_in.
 * @throws {Error} Se a requisição à Shopee falhar ou os tokens não forem retornados.
 */
async function getAccessToken(code, shop_id, clientId) {
  const path = '/api/v2/auth/token/get'; // Endpoint para a primeira obtenção de token
  const timestamp = Math.floor(Date.now() / 1000);

  console.log('[DEBUG_AUTH] getAccessToken - Iniciando processo para Shop ID:', shop_id);
  console.log(`[DEBUG_AUTH] getAccessToken - Code recebido (parcial): ${code ? code.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);
  console.log(`[DEBUG_AUTH] getAccessToken - Partner ID: ${SHOPEE_PARTNER_ID_LIVE}, Path: ${path}, Timestamp: ${timestamp}`);

  const baseString = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}`;

  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID_LIVE,
    partner_key: SHOPEE_API_KEY_LIVE,
    timestamp: timestamp,
  }, baseString);

  const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${sign}`;

  console.log(`[DEBUG_AUTH] getAccessToken - URL da requisição do token: ${url}`);
  console.log(`[DEBUG_AUTH] getAccessToken - Payload da requisição: ${JSON.stringify({
    code: code ? code.substring(0, 10) + '...' : 'NULO/UNDEFINED',
    shop_id: Number(shop_id),
    partner_id: Number(SHOPEE_PARTNER_ID_LIVE),
  })}`);

  try {
    const response = await axios.post(
      url,
      {
        code: code,
        shop_id: Number(shop_id),
        partner_id: Number(SHOPEE_PARTNER_ID_LIVE),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    // --- LOG CRÍTICO DA RESPOSTA RAW DA SHOPEE ---
    console.log('--- DEBUG: Resposta RAW da Shopee para GetAccessToken ---');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('------------------------------------------------------');
    // --- FIM DO LOG CRÍTICO ---

    // Verifica se 'response' e seus campos esperados existem na resposta da Shopee
    if (!response.data || !response.data.response) {
        // Se a Shopee retornar um erro diretamente no nível superior (response.data.error)
        if (response.data.error || response.data.message) {
            const shopeeError = response.data.error || 'N/A';
            const shopeeMessage = response.data.message || 'N/A';
            throw new Error(`Erro da API Shopee: ${shopeeError} - ${shopeeMessage}. Resposta completa no log acima.`);
        }
        // Se não for um erro reconhecido, é um formato inesperado.
        throw new Error('Formato de resposta inesperado da Shopee: objeto "response" ausente ou inválido.');
    }

    const { access_token, expire_in, refresh_token } = response.data.response;

    if (!access_token || !refresh_token || typeof expire_in === 'undefined') {
        throw new Error(`Dados de token incompletos na resposta da Shopee. Access Token: ${access_token}, Refresh Token: ${refresh_token}, Expire In: ${expire_in}`);
    }

    // Calcula a nova data/hora de expiração
    const newExpiresAt = new Date(Date.now() + expire_in * 1000).toISOString();

    console.log('[DEBUG_AUTH] getAccessToken - Tokens recebidos da Shopee (parcial):');
    console.log(`  - access_token: ${access_token ? access_token.substring(0, 10) + '...' : 'NULO'}`);
    console.log(`  - refresh_token: ${refresh_token ? refresh_token.substring(0, 30) + '...' : 'NULO'}`);
    console.log(`  - expire_in: ${expire_in} segundos`);
    console.log(`  - newExpiresAt: ${newExpiresAt}`);

    // Salva ou atualiza os tokens no Supabase
    const { data, error } = await supabase
      .from('client_connections')
      .upsert({
        client_id: clientId,
        connection_name: 'shopee',
        shop_id: shop_id,
        access_token: access_token,
        refresh_token: refresh_token,
        access_token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: ['client_id', 'connection_name', 'shop_id'], ignoreDuplicates: false })
      .select();

    if (error) {
      console.error('❌ [getAccessToken] Erro ao salvar tokens no Supabase:', error.message);
      throw error;
    }

    console.log('🎉 Tokens salvos/atualizados no Supabase com sucesso.');
    return { access_token, refresh_token, expire_in };

  } catch (error) {
    console.error('❌ [getAccessToken] Erro ao obter tokens da Shopee.');
    if (axios.isAxiosError(error) && error.response) {
      console.error('[DEBUG_AUTH] getAccessToken - Detalhes do erro da API Shopee (Axios response):', JSON.stringify(error.response.data, null, 2));
      console.error(`[DEBUG_AUTH] getAccessToken - Status HTTP: ${error.response.status}`);
      // Propaga o erro com a mensagem da Shopee, se disponível
      const shopeeErrorMessage = error.response.data.message || 'Erro desconhecido na resposta da Shopee.';
      throw new Error(`Falha na obtenção do token: ${shopeeErrorMessage}`);
    } else {
      console.error('[DEBUG_AUTH] getAccessToken - Erro geral:', error.message);
      throw error;
    }
  }
}

/**
 * Refresca um access_token expirado usando o refresh_token.
 * Este método também retorna um NOVO refresh_token, que deve ser salvo
 * para futuras operações de refresh.
 *
 * @param {number} connectionId O ID da conexão na sua base de dados (Supabase).
 * @param {string} shop_id O ID da loja Shopee.
 * @param {string} refreshToken O refresh_token atual a ser usado (será invalidado após o uso).
 * @returns {string} O novo access_token válido.
 * @throws {Error} Se a requisição de refresh falhar.
 */
async function refreshShopeeAccessToken(connectionId, shop_id, refreshToken) {
  console.log(`🔄 [refreshShopeeAccessToken] Iniciando processo de refresh para Shop ID: ${shop_id} (Connection ID: ${connectionId})...`);
  console.log(`[DEBUG_AUTH] refreshShopeeAccessToken - Refresh Token recebido (parcial): ${refreshToken ? refreshToken.substring(0, 30) + '...' : 'NULO/UNDEFINED'}`);
  console.log(`[DEBUG_AUTH] refreshShopeeAccessToken - Partner ID: ${SHOPEE_PARTNER_ID_LIVE}, Partner Key (parcial): ${SHOPEE_API_KEY_LIVE ? SHOPEE_API_KEY_LIVE.substring(0, 5) + '...' : 'NULO/UNDEFINED'}`);

  const path = '/api/v2/auth/access_token/get'; // Endpoint correto para refresh de token
  const timestamp = Math.floor(Date.now() / 1000);

  // A base string para a assinatura de refresh é: partner_id + path + timestamp
  const baseStringForRefreshSign = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}`;

  console.log(`[DEBUG_AUTH] refreshShopeeAccessToken - Base string para assinatura: "${baseStringForRefreshSign}"`);

  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID_LIVE,
    partner_key: SHOPEE_API_KEY_LIVE,
    timestamp: timestamp,
  }, baseStringForRefreshSign);

  const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${sign}`;

  console.log(`[DEBUG_AUTH] refreshShopeeAccessToken - URL da requisição de refresh: ${url}`);
  console.log(`[DEBUG_AUTH] refreshShopeeAccessToken - Payload da requisição de refresh: ${JSON.stringify({
    shop_id: Number(shop_id),
    partner_id: Number(SHOPEE_PARTNER_ID_LIVE),
    refresh_token: refreshToken ? refreshToken.substring(0, 30) + '...' : 'NULO/UNDEFINED',
  })}`);

  try {
    const response = await axios.post(
      url,
      {
        shop_id: Number(shop_id),
        partner_id: Number(SHOPEE_PARTNER_ID_LIVE),
        refresh_token: refreshToken,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    // --- LOG CRÍTICO DA RESPOSTA RAW DA SHOPEE ---
    console.log('--- DEBUG: Resposta RAW da Shopee para Refresh Token ---');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('----------------------------------------------------');
    // --- FIM DO LOG CRÍTICO ---

    // Verifica se 'response' e seus campos esperados existem na resposta da Shopee
    if (!response.data || !response.data.response) {
        // Se a Shopee retornar um erro diretamente no nível superior (response.data.error)
        if (response.data.error || response.data.message) {
            const shopeeError = response.data.error || 'N/A';
            const shopeeMessage = response.data.message || 'N/A';
            throw new Error(`Erro da API Shopee: ${shopeeError} - ${shopeeMessage}. Resposta completa no log acima.`);
        }
        // Se não for um erro reconhecido, é um formato inesperado.
        throw new Error('Formato de resposta inesperado da Shopee: objeto "response" ausente ou inválido.');
    }

    const { access_token: newAccessToken, expire_in, refresh_token: newRefreshToken } = response.data.response;

    if (!newAccessToken || !newRefreshToken || typeof expire_in === 'undefined') {
        throw new Error(`Dados de token incompletos na resposta da Shopee. Access Token: ${newAccessToken}, Refresh Token: ${newRefreshToken}, Expire In: ${expire_in}`);
    }

    // Calcula a nova data/hora de expiração
    const newExpiresAt = new Date(Date.now() + expire_in * 1000).toISOString();

    console.log(`✅ [refreshShopeeAccessToken] Resposta bem-sucedida da Shopee para refresh. Novos tokens (parcial):`);
    console.log(`  - newAccessToken: ${newAccessToken ? newAccessToken.substring(0, 10) + '...' : 'NULO'}`);
    console.log(`  - newRefreshToken: ${newRefreshToken ? newRefreshToken.substring(0, 30) + '...' : 'NULO'}`);
    console.log(`  - expire_in: ${expire_in} segundos`);
    console.log(`  - newExpiresAt: ${newExpiresAt}`);

    // Atualiza a tabela client_connections com os novos tokens
    const { data, error } = await supabase
      .from('client_connections')
      .update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken, // Importante: SEMPRE atualize o refresh token também!
        access_token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId); // Usa o 'id' da conexão para identificar a linha no Supabase

    if (error) {
      console.error('❌ [refreshShopeeAccessToken] Erro ao atualizar Supabase com novos tokens:', error.message);
      throw error;
    }

    console.log(`✅ [refreshShopeeAccessToken] Token refrescado e salvo no Supabase para Shop ID: ${shop_id}.`);
    return newAccessToken;

  } catch (error) {
    console.error('❌ [refreshShopeeAccessToken] Erro ao refrescar token Shopee.');
    if (axios.isAxiosError(error) && error.response) {
      console.error('[DEBUG_AUTH] refreshShopeeAccessToken - Detalhes do erro da API Shopee (Axios response):', JSON.stringify(error.response.data, null, 2));
      console.error(`[DEBUG_AUTH] refreshShopeeAccessToken - Status HTTP: ${error.response.status}`);
      // Propaga o erro com a mensagem da Shopee, se disponível
      const shopeeErrorMessage = error.response.data.message || 'Erro desconhecido na resposta da Shopee.';
      throw new Error(`Falha no refresh do token: ${shopeeErrorMessage}`);
    } else {
      console.error('[DEBUG_AUTH] refreshShopeeAccessToken - Erro geral:', error.message);
      throw error;
    }
  }
}

module.exports = {
  generateAuthUrl,
  getAccessToken,
  refreshShopeeAccessToken,
};