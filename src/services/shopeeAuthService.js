// src/services/shopeeAuthService.js
const axios = require('axios');
const crypto = require('crypto');
const shopeeConfig = require('../config/shopeeConfig');
const supabase = require('../config/supabase');

const {
    SHOPEE_PARTNER_ID_LIVE,
    SHOPEE_API_KEY_LIVE,
    SHOPEE_AUTH_HOST_LIVE,
    SHOPEE_API_HOST_LIVE
} = shopeeConfig;

/**
 * Gera o link de autorização da Shopee para o lojista.
 * @returns {string} A URL de autorização.
 */
function generateShopeeAuthLink() {
    const timest = Math.floor(Date.now() / 1000);
    const path = "/api/v2/shop/auth_partner";
    const tmpBaseString = `${SHOPEE_PARTNER_ID_LIVE}${path}${timest}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE)
                        .update(tmpBaseString)
                        .digest('hex');

    const url = (
        `${SHOPEE_AUTH_HOST_LIVE}${path}` +
        `?partner_id=${SHOPEE_PARTNER_ID_LIVE}` +
        `&redirect=${encodeURIComponent(shopeeConfig.SHOPEE_REDIRECT_URL_LIVE)}` +
        `&timestamp=${timest}` +
        `&sign=${sign}`
    );
    return url;
}

/**
 * Obtém o access_token e refresh_token usando o code da Shopee.
 * @param {string} code O código de autorização obtido da Shopee.
 * @param {string} [shopId] O ID da loja (opcional).
 * @param {string} [mainAccountId] O ID da conta principal (opcional).
 * @returns {Promise<object>} Um objeto contendo access_token, refresh_token, expire_in e listas de IDs.
 */
async function getAccessTokenFromCode(code, shopId, mainAccountId) {
    const path = "/api/v2/auth/token/get";
    const timestamp = Math.floor(Date.now() / 1000);
    let requestBody = { code: code, partner_id: SHOPEE_PARTNER_ID_LIVE };

    if (shopId) requestBody.shop_id = Number(shopId);
    else if (mainAccountId) requestBody.main_account_id = Number(mainAccountId);

    const baseString = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');

    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${sign}`;

    try {
        const response = await axios.post(url, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.data.error) throw new Error(response.data.message || 'Erro desconhecido ao obter access token.');
        return response.data;
    } catch (error) {
        console.error('Erro em getAccessTokenFromCode:', error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Falha ao obter access token: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}

/**
 * Atualiza o access_token usando o refresh_token.
 * @param {string} refreshToken O refresh token atual.
 * @param {number} [shopId] O ID da loja.
 * @param {number} [mainAccountId] O ID da conta principal.
 * @returns {Promise<object>} Um objeto contendo access_token, refresh_token e expire_in.
 */
async function refreshShopeeAccessToken(refreshToken, shopId, mainAccountId) {
    const path = "/api/v2/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);
    let requestBody = { refresh_token: refreshToken, partner_id: SHOPEE_PARTNER_ID_LIVE };

    if (shopId) requestBody.shop_id = Number(shopId);
    else if (mainAccountId) requestBody.main_account_id = Number(mainAccountId);

    const baseString = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');

    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${sign}`;

    try {
        const response = await axios.post(url, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.data.error) throw new Error(response.data.message || 'Erro desconhecido ao refrescar access token.');
        return response.data;
    } catch (error) {
        console.error('Erro em refreshShopeeAccessToken:', error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Falha ao refrescar access token: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}

/**
 * Busca e valida os tokens de acesso e refresh no Supabase.
 * Se o token estiver expirado, tenta refrescá-lo e o atualiza no Supabase.
 * @param {string} id O ID da loja ou conta principal.
 * @param {string} idType 'shop_id' ou 'main_account_id'.
 * @returns {Promise<object>} Um objeto contendo access_token, refresh_token e partner_id.
 */
async function getValidatedShopeeTokens(id, idType) {
    const { data: connectionData, error: fetchError } = await supabase
        .from('api_connections_shopee')
        .select('access_token, refresh_token, token_expires_at, partner_id, shop_id, main_account_id')
        .eq(idType, Number(id))
        .single();

    if (fetchError || !connectionData) {
        throw new Error('Tokens não encontrados ou erro ao buscar no Supabase.');
    }

    let accessToken = connectionData.access_token;
    const refreshToken = connectionData.refresh_token;
    const expiresAt = new Date(connectionData.token_expires_at);
    const now = new Date();
    const partnerId = connectionData.partner_id;

    if (now >= expiresAt) {
        console.log(`Access Token para ${idType}: ${id} expirado. Tentando refrescar...`);
        try {
            const newTokens = await refreshShopeeAccessToken(refreshToken, connectionData.shop_id, connectionData.main_account_id);
            accessToken = newTokens.access_token;
            const newExpiresAt = new Date(Date.now() + newTokens.expire_in * 1000);

            const { error: updateError } = await supabase
                .from('api_connections_shopee')
                .upsert({
                    [idType]: Number(id),
                    access_token: accessToken,
                    refresh_token: newTokens.refresh_token, // O refresh token também pode mudar
                    token_expires_at: newExpiresAt.toISOString(),
                    last_updated_at: new Date().toISOString()
                }, { onConflict: idType });

            if (updateError) {
                console.error('Erro ao atualizar tokens no Supabase após refresh:', updateError.message);
                throw new Error('Erro ao atualizar tokens no Supabase.');
            }
        } catch (refreshError) {
            console.error('Falha ao refrescar Access Token:', refreshError.message);
            throw new Error(`Falha ao refrescar Access Token. Detalhes: ${refreshError.message}`);
        }
    }
    return { access_token: accessToken, refresh_token: refreshToken, partner_id: partnerId };
}

module.exports = {
    generateShopeeAuthLink,
    getAccessTokenFromCode,
    refreshShopeeAccessToken,
    getValidatedShopeeTokens,
};