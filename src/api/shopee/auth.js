// src/api/shopee/auth.js
const axios = require('axios');
const { generateShopeeSignature } = require('../../utils/security');

// Variáveis de ambiente - Certifique-se de que estão definidas no Render
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE;
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE;

/**
 * Troca um código de autorização da Shopee por um access_token e refresh_token.
 *
 * @param {string} code O código de autorização obtido após o usuário autorizar sua loja.
 * @param {string} shopId O ID da loja Shopee.
 * @returns {object} Um objeto contendo access_token, refresh_token e expire_in.
 * @throws {Error} Se a troca de token falhar.
 */
async function getAccessTokenFromCode(code, shopId) {
    console.log(`[SHOPEE_AUTH] Iniciando troca de code por token para Shop ID: ${shopId}`);
    console.log(`[SHOPEE_AUTH] Code recebido: ${code ? code.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);

    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000); // Timestamp atual em segundos

    const body = {
        shop_id: Number(shopId), // Converte para número, se necessário
        code: code,
        partner_id: Number(SHOPEE_PARTNER_ID_LIVE), // Use o Live Partner ID
    };

    console.log(`[SHOPEE_AUTH] Parâmetros para assinatura (body): ${JSON.stringify(body)}`);

    // A assinatura para POST usa o corpo da requisição
    const sign = generateShopeeSignature({
        path: path,
        partner_id: SHOPEE_PARTNER_ID_LIVE,
        partner_key: SHOPEE_API_KEY_LIVE,
        timestamp: timestamp,
        body: body // O corpo é usado para gerar a assinatura em requisições POST
    });

    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${body.partner_id}&timestamp=${timestamp}&sign=${sign}`;

    console.log(`[SHOPEE_AUTH] URL para obter token: ${url}`);
    console.log(`[SHOPEE_AUTH] Corpo da requisição: ${JSON.stringify(body)}`);

    try {
        const response = await axios.post(url, body, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        console.log('--- DEBUG: Resposta RAW da Shopee para GetAccessToken ---');
        console.log(JSON.stringify(response.data, null, 2));
        console.log(`--- DEBUG: Status HTTP da Resposta de GetAccessToken: ${response.status} ---`);
        console.log('----------------------------------------------------');

        if (response.data && response.data.access_token && response.data.refresh_token) {
            console.log(`✅ [SHOPEE_AUTH] Access Token obtido com sucesso para Shop ID ${shopId}.`);
            return {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                expire_in: response.data.expire_in // Tempo de expiração do access_token em segundos
            };
        } else if (response.data.error || response.data.message) {
            const shopeeError = response.data.error || 'N/A';
            const shopeeMessage = response.data.message || 'N/A';
            throw new Error(`Erro da API Shopee (GetAccessToken): ${shopeeError} - ${shopeeMessage}.`);
        } else {
            throw new Error('Formato de resposta inesperado da Shopee para GetAccessToken.');
        }

    } catch (error) {
        console.error('❌ [SHOPEE_AUTH] Erro ao trocar code por token:', error.message);
        if (axios.isAxiosError(error) && error.response) {
            console.error('[SHOPEE_AUTH] Detalhes do erro da API Shopee (Axios response):', JSON.stringify(error.response.data, null, 2));
            console.error(`[SHOPEE_AUTH] Status HTTP: ${error.response.status}`);
            const shopeeErrorMessage = error.response.data.message || 'Erro desconhecido na resposta da Shopee.';
            throw new Error(`Request failed with status code ${error.response.status}: ${shopeeErrorMessage}`);
        } else {
            console.error('[SHOPEE_AUTH] Erro geral:', error.message);
            throw error;
        }
    }
}

module.exports = {
    getAccessTokenFromCode,
};