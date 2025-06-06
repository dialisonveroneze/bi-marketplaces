// src/services/shopeeAuthService.js
const axios = require('axios');
const crypto = require('crypto');
const shopeeConfig = require('../config/shopeeConfig');
const supabase = require('../config/supabase'); // Caminho corrigido para supabase.js

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
    const tmpBaseString = `${SHOPEE_PARTNER_ID_LIVE}${path}${timest}`;

    // Gera a assinatura usando HMAC-SHA256 com a API Key como segredo
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE)
                        .update(tmpBaseString)
                        .digest('hex'); // Formato hexadecimal

    // Constrói a URL de autorização com todos os parâmetros necessários
    const url = (
        `${SHOPEE_AUTH_HOST_LIVE}${path}` +
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
    const baseString = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');

    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${sign}`;

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

    const baseString = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');

    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${sign}`;

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
        throw new Error(`Falha ao refrescar access token da Shopee: ${errorMessage}`);
    } finally {
        console.log(`--- [AuthService:refreshShopeeAccessToken] FIM DA REQUISIÇÃO ---\n`);
    }
}

/**
 * Busca os tokens de acesso e refresh do Supabase para um dado shop_id ou main_account_id.
 * Se o token estiver expirado, tenta refrescá-lo e o atualiza no Supabase.
 * @param {string} id O ID da loja ou conta principal.
 * @param {string} idType 'shop_id' ou 'main_account_id'.
 * @returns {Promise<object>} Um objeto contendo access_token, refresh_token e partner_id.
 * @throws {Error} Se os tokens não forem encontrados ou falharem ao serem refrescados.
 */
async function getValidatedShopeeTokens(id, idType) {
    console.log(`\n[AuthService:getValidatedShopeeTokens] Buscando tokens no Supabase para ${idType}: ${id}`);
    const { data: connectionData, error: fetchError } = await supabase
        .from('client_connections')
        //.select('access_token, refresh_token, access_token_expires_at, additional_data->>partner_id, additional_data->>shop_id, additional_data->>main_account_id')
        .select('access_token, refresh_token, access_token_expires_at, additional_data->>partner_id, client_id, additional_data->>main_account_id')
        .eq(idType === 'client_id' ? 'client_id' : 'client_id', String(id)) // <-- CORREÇÃO
        .single();

    if (fetchError || !connectionData) {
        console.error(`❌ [AuthService:getValidatedShopeeTokens] Erro ao buscar tokens no Supabase para ${idType}: ${id}. Detalhes: ${fetchError ? fetchError.message : 'Tokens não encontrados.'}`);
        throw new Error('Tokens não encontrados para o ID fornecido. Por favor, autorize a loja/conta principal primeiro.');
    }

    let accessToken = connectionData.access_token;
    let refreshToken = connectionData.refresh_token;
    const expiresAt = new Date(connectionData.access_token_expires_at); // Convertendo para objeto Date
    const now = new Date();
    const partnerId = connectionData.partner_id;

    console.log(`[AuthService:getValidatedShopeeTokens] Token atual para ${idType}: ${id}`);
    console.log(`  Access Token (primeiros 5 caracteres): ${accessToken.substring(0, 5)}...`);
    console.log(`  Refresh Token (primeiros 5 caracteres): ${refreshToken.substring(0, 5)}...`);
    console.log(`  Expira em: ${expiresAt.toISOString()} (Agora: ${now.toISOString()})`);


    const expirationBuffer = 5 * 60 * 1000; // 5 minutos em milissegundos
    if (now.getTime() >= (expiresAt.getTime() - expirationBuffer)) {
        console.log(`🔄 [AuthService:getValidatedShopeeTokens] Access Token para ${idType}: ${id} expirado ou próximo de expirar. Tentando refrescar...`);
        try {
            // Chama a função de refresh, passando os IDs corretos
            const newTokens = await refreshShopeeAccessToken(refreshToken, connectionData.shop_id, connectionData.main_account_id);
            accessToken = newTokens.access_token;
            refreshToken = newTokens.refresh_token; // O refresh token também pode ser atualizado
            const newExpiresAt = new Date(Date.now() + newTokens.expire_in * 1000); // Nova data de expiração

            console.log(`[AuthService:getValidatedShopeeTokens] Novos tokens obtidos: Access Token (primeiros 5 caracteres): ${accessToken.substring(0, 5)}..., Expira em: ${newExpiresAt.toISOString()}`);

            // Atualiza os tokens no Supabase
            const { error: updateError } = await supabase
                .from('client_connections')
                .upsert({
                    [idType]: Number(id), // Usa o ID da loja ou conta principal para o upsert
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    access_token_expires_at: newExpiresAt.toISOString(), // Salva em formato ISO 8601
                    last_updated_at: new Date().toISOString()
                }, { onConflict: idType }); // Conflito pelo shop_id ou main_account_id

            if (updateError) {
                console.error('❌ [AuthService:getValidatedShopeeTokens] Erro ao atualizar tokens no Supabase após refresh:', updateError.message);
                // Mesmo com erro de atualização, o novo access_token foi obtido e pode ser usado
            } else {
                console.log(`✅ [AuthService:getValidatedShopeeTokens] Tokens para ${idType}: ${id} refrescados e atualizados no Supabase.`);
            }
        } catch (refreshError) {
            console.error('❌ [AuthService:getValidatedShopeeTokens] Falha ao refrescar Access Token:', refreshError.message);
            throw new Error(`Falha ao refrescar Access Token. Por favor, tente autorizar a loja novamente. Detalhes: ${refreshError.message}`);
        }
    } else {
        console.log(`✅ [AuthService:getValidatedShopeeTokens] Access Token para ${idType}: ${id} ainda válido.`);
    }
    console.log(`--- [AuthService:getValidatedShopeeTokens] FIM DA VALIDAÇÃO ---\n`);

    return { access_token: accessToken, refresh_token: refreshToken, partner_id: partnerId };
}

module.exports = {
    generateShopeeAuthLink,
    getAccessTokenFromCode,
    refreshShopeeAccessToken,
    getValidatedShopeeTokens,
};