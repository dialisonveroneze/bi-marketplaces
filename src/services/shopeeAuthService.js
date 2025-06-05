// src/services/shopeeAuthService.js
const axios = require('axios');
const crypto = require('crypto');
const shopeeConfig = require('../config/shopeeConfig');
const supabase = require('../config/supabase');

const {
    SHOPEE_PARTNER_ID_LIVE,
    SHOPEE_API_KEY_LIVE,
    SHOPEE_AUTH_HOST_LIVE,
    SHOPEE_API_HOST_LIVE,
    SHOPEE_REDIRECT_URL_LIVE
} = shopeeConfig;

/**
 * Gera o link de autorização da Shopee para o lojista iniciar o processo OAuth.
 * @returns {string} A URL de autorização para a qual o usuário deve ser redirecionado.
 */
function generateShopeeAuthLink() {
    const timest = Math.floor(Date.now() / 1000); // Timestamp em segundos
    const path = "/api/v2/shop/auth_partner";

    // A string base para a assinatura é composta por: Partner ID + Path da API + Timestamp
    const tmpBaseString = `<span class="math-inline">\{SHOPEE\_PARTNER\_ID\_LIVE\}</span>{path}${timest}`;

    // Gera a assinatura usando HMAC-SHA256 com a API Key como segredo
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE)
                        .update(tmpBaseString)
                        .digest('hex'); // Formato hexadecimal

    // Constrói a URL de autorização com todos os parâmetros necessários
    const url = (
        `<span class="math-inline">\{SHOPEE\_AUTH\_HOST\_LIVE\}</span>{path}` +
        `?partner_id=${SHOPEE_PARTNER_ID_LIVE}` +
        `&redirect=${encodeURIComponent(SHOPEE_REDIRECT_URL_LIVE)}` + // URL de callback da sua aplicação
        `&timestamp=${timest}` +
        `&sign=${sign}`
    );
    console.log(`[AuthService:generateAuthLink] Link de Autorização Gerado: ${url}`);
    return url;
}

/**
 * Obtém o access_token e refresh_token da Shopee usando o "code" fornecido
 * após a autorização do lojista.
 * @param {string} code O código de autorização obtido da Shopee.
 * @param {string} [shopId] O ID da loja, se for uma autorização de loja individual.
 * @param {string} [mainAccountId] O ID da conta principal, se for uma autorização de parceiro.
 * @returns {Promise<object>} Um objeto contendo access_token, refresh_token, expire_in e listas de IDs.
 */
async function getAccessTokenFromCode(code, shopId, mainAccountId) {
    const path = "/api/v2/auth/token/get";
    const timestamp = Math.floor(Date.now() / 1000);

    let requestBody = {
        code: code,
        partner_id: SHOPEE_PARTNER_ID_LIVE
    };

    if (shopId) {
        requestBody.shop_id = Number(shopId);
    } else if (mainAccountId) {
        requestBody.main_account_id = Number(mainAccountId);
    }

    // A base string para a assinatura do token/get não inclui o body da requisição, apenas parâmetros de URL e headers.
    // Para esta API específica, a assinatura é baseada em partner_id, path, timestamp.
    const baseString = `<span class="math-inline">\{SHOPEE\_PARTNER\_ID\_LIVE\}</span>{path}${timestamp}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');

    const url = `<span class="math-inline">\{SHOPEE\_API\_HOST\_LIVE\}</span>{path}?partner_id=<span class="math-inline">\{SHOPEE\_PARTNER\_ID\_LIVE\}&timestamp\=</span>{timestamp}&sign=${sign}`;

    console.log(`\n--- [AuthService:getAccessTokenFromCode] INÍCIO DA REQUISIÇÃO ---`);
    console.log(`  URL de Requisição: ${url}`);
    console.log(`  Corpo da Requisição (JSON enviado): ${JSON.stringify(requestBody)}`);
    console.log(`  Parâmetros para Assinatura (baseString): ${baseString}`);
    console.log(`  Assinatura Gerada (sign): ${sign}`);

    try {
        const response = await axios.post(url, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`--- [AuthService:getAccessTokenFromCode] RESPOSTA DA SHOPEE ---`);
        console.log(`  Status HTTP: ${response.status}`);
        console.log(`  Dados da Resposta (JSON recebido): ${JSON.stringify(response.data)}`);

        if (response.data.error) {
            throw new Error(response.data.message || `Erro desconhecido ao obter access token: ${JSON.stringify(response.data)}`);
        }
        return {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expire_in: response.data.expire_in, // Tempo de expiração em segundos
            merchant_id_list: response.data.merchant_id_list, // Para contas de parceiro
            shop_id_list: response.data.shop_id_list // Para contas de parceiro
        };
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`❌ [AuthService:getAccessTokenFromCode] Erro na requisição: ${errorMessage}`);
        // Detalhes adicionais do erro HTTP se disponíveis
        if (error.response) {
            console.error(`❌ [AuthService:getAccessTokenFromCode] HTTP Status Erro: ${error.response.status}`);
            console.error(`❌ [AuthService:getAccessTokenFromCode] Dados do Erro Recebido: ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`Falha ao obter access token da Shopee: ${errorMessage}`);
    } finally {
        console.log(`--- [AuthService:getAccessTokenFromCode] FIM DA REQUISIÇÃO ---\n`);
    }
}

/**
 * Atualiza o access_token usando o refresh_token, quando o access_token existente expira.
 * @param {string} refreshToken O refresh token atual.
 * @param {number} [shopId] O ID da loja (se for uma conta de loja).
 * @param {number} [mainAccountId] O ID da conta principal (se for uma conta principal).
 * @returns {Promise<object>} Um objeto contendo o novo access_token, refresh_token e expire_in.
 */
async function refreshShopeeAccessToken(refreshToken, shopId, mainAccountId) {
    const path = "/api/v2/auth/access_token/get"; // Endpoint para refresh
    const timestamp = Math.floor(Date.now() / 1000);

    let requestBody = {
        refresh_token: refreshToken,
        partner_id: SHOPEE_PARTNER_ID_LIVE
    };

    if (shopId) {
        requestBody.shop_id = Number(shopId);
    } else if (mainAccountId) {
        requestBody.main_account_id = Number(mainAccountId);
    }

    const baseString = `<span class="math-inline">\{SHOPEE\_PARTNER\_ID\_LIVE\}</span>{path}${timestamp}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');

    const url = `<span class="math-inline">\{SHOPEE\_API\_HOST\_LIVE\}</span>{path}?partner_id=<span class="math-inline">\{SHOPEE\_PARTNER\_ID\_LIVE\}&timestamp\=</span>{timestamp}&sign=${sign}`;

    console.log(`\n--- [AuthService:refreshShopeeAccessToken] INÍCIO DA REQUISIÇÃO ---`);
    console.log(`  URL de Requisição: ${url}`);
    console.log(`  Corpo da Requisição (JSON enviado): ${JSON.stringify(requestBody)}`);
    console.log(`  Parâmetros para Assinatura (baseString): ${baseString}`);
    console.log(`  Assinatura Gerada (sign): ${sign}`);

    try {
        const response = await axios.post(url, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`--- [AuthService:refreshShopeeAccessToken] RESPOSTA DA SHOPEE ---`);
        console.log(`  Status HTTP: ${response.status}`);
        console.log(`  Dados da Resposta (JSON recebido): ${JSON.stringify(response.data)}`);

        if (response.data.error) {
            throw new Error(response.data.message || `Erro desconhecido ao refrescar access token: ${JSON.stringify(response.data)}`);
        }
        return {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expire_in: response.data.expire_in,
            merchant_id_list: response.data.merchant_id_list,
            shop_id_list: response.data.shop_id_list
        };
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`❌ [AuthService:refreshShopeeAccessToken] Erro na requisição: ${errorMessage}`);
        if (error.response) {
            console.error(`❌ [AuthService:refreshShopeeAccessToken] HTTP Status Erro: ${error.response.status}`);
            console.error(`❌ [AuthService:refreshShopeeAccessToken] Dados do Erro Recebido: ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`Fal