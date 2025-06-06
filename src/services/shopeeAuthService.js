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
        `&redirect=${encodeURIComponent(SHOPEE_REDIRECT_URL_LIVE)}` +
        `&timestamp=${timest}` +
        `&sign=${sign}`
    );
    console.log(`[AuthService:generateAuthLink] Link de Autorização Gerado: ${url}`);
    return url;
}

async function getAccessTokenFromCode(code, shopId, mainAccountId) {
    const path = "/api/v2/auth/token/get";
    const timestamp = Math.floor(Date.now() / 1000);

    let requestBody = {
        code: code,
        partner_id: SHOPEE_PARTNER_ID_LIVE // Corrigido typo
    };

    if (shopId) {
        requestBody.shop_id = Number(shopId);
    } else if (mainAccountId) {
        requestBody.main_account_id = Number(mainAccountId);
    }

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
            expire_in: response.data.expire_in,
            merchant_id_list: response.data.merchant_id_list,
            shop_id_list: response.data.shop_id_list
        };
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`❌ [AuthService:getAccessTokenFromCode] Erro na requisição: ${errorMessage}`);
        if (error.response) {
            console.error(`❌ [AuthService:getAccessTokenFromCode] HTTP Status Erro: ${error.response.status}`);
            console.error(`❌ [AuthService:getAccessTokenFromCode] Dados do Erro Recebido: ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`Falha ao obter access token da Shopee: ${errorMessage}`);
    } finally {
        console.log(`--- [AuthService:getAccessTokenFromCode] FIM DA REQUISIÇÃO ---\n`);
    }
}

async function refreshShopeeAccessToken(refreshToken, shopId, mainAccountId) {
    const path = "/api/v2/auth/access_token/get";
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

async function getValidatedShopeeTokens(id, idType) {
    console.log(`\n[AuthService:getValidatedShopeeTokens] Buscando tokens no Supabase para ${idType}: ${id}`);
    let queryColumn;
    let queryValue;

    if (idType === 'shop_id') {
        queryColumn = 'additional_data->>shop_id';
        queryValue = String(id);
    } else if (idType === 'main_account_id') {
        queryColumn = 'additional_data->>main_account_id';
        queryValue = String(id);
        console.warn(`[AuthService:getValidatedShopeeTokens] Aviso: A busca por 'main_account_id' assume que 'additional_data->>main_account_id' está configurado na tabela 'client_connections'.`);
    } else {
        throw new Error("idType inválido. Deve ser 'shop_id' ou 'main_account_id'.");
    }

    const { data: connectionData, error: fetchError } = await supabase
        .from('client_connections')
        .select('access_token, refresh_token, access_token_expires_at, additional_data->>partner_id, additional_data->>shop_id, additional_data->>main_account_id, client_id')
        .eq(queryColumn, queryValue)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error(`❌ [AuthService:getValidatedShopeeTokens] Erro ao buscar tokens no Supabase para ${idType}: ${id}. Detalhes: ${fetchError.message}`);
        throw new Error(`Erro ao buscar tokens no Supabase: ${fetchError.message}`);
    }
    
    if (!connectionData) {
        console.warn(`[AuthService:getValidatedShopeeTokens] Nenhum token encontrado para ${idType}: ${id}.`);
        throw new Error('Tokens não encontrados para o ID fornecido. Por favor, autorize a loja/conta principal primeiro.');
    }

    let accessToken = connectionData.access_token;
    let refreshToken = connectionData.refresh_token;
    const expiresAt = new Date(connectionData.access_token_expires_at);
    const now = new Date();
    const partnerId = connectionData.partner_id;
    const sup_shop_id = connectionData.shop_id ? Number(connectionData.shop_id) : undefined;
    const sup_main_account_id = connectionData.main_account_id ? Number(connectionData.main_account_id) : undefined;


    console.log(`[AuthService:getValidatedShopeeTokens] Token atual para ${idType}: ${id}`);
    console.log(`  Access Token (primeiros 5 caracteres): ${accessToken.substring(0, 5)}...`);
    console.log(`  Refresh Token (primeiros 5 caracteres): ${refreshToken.substring(0, 5)}...`);
    console.log(`  Expira em: ${expiresAt.toISOString()} (Agora: ${now.toISOString()})`);


    const expirationBuffer = 5 * 60 * 1000;
    if (now.getTime() >= (expiresAt.getTime() - expirationBuffer)) {
        console.log(`🔄 [AuthService:getValidatedShopeeTokens] Access Token para ${idType}: ${id} expirado ou próximo de expirar. Tentando refrescar...`);
        try {
            const newTokens = await refreshShopeeAccessToken(refreshToken, sup_shop_id, sup_main_account_id);
            accessToken = newTokens.access_token;
            refreshToken = newTokens.refresh_token;
            const newExpiresAt = new Date(Date.now() + newTokens.expire_in * 1000);

            console.log(`[AuthService:getValidatedShopeeTokens] Novos tokens obtidos: Access Token (primeiros 5 caracteres): ${accessToken.substring(0, 5)}..., Expira em: ${newExpiresAt.toISOString()}`);

            const updateObject = {
                access_token: accessToken,
                refresh_token: refreshToken,
                access_token_expires_at: newExpiresAt.toISOString(),
                last_updated_at: new Date().toISOString()
            };

            const { error: updateError } = await supabase
                .from('client_connections')
                .update(updateObject)
                .eq(queryColumn, queryValue);
            
            if (updateError) {
                console.error('❌ [AuthService:getValidatedShopeeTokens] Erro ao atualizar tokens no Supabase após refresh:', updateError.message);
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

    return { access_token: accessToken, refresh_token: refreshToken, partner_id: partnerId, shop_id: sup_shop_id, main_account_id: sup_main_account_id };
}

function generateShopeeSignature(path, partnerId, timestamp, accessToken, shopId) {
    // CORREÇÃO FINAL: INCLUIR shopId NA BASE STRING para GET_ORDER_LIST.
    // É um comportamento peculiar da Shopee para este e alguns outros endpoints de loja.
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}${SHOPEE_API_KEY_LIVE}`;

    console.log("\n--- DEBUG SIGNATURE START ---");
    console.log("DEBUG SIGNATURE - partnerId:", partnerId);
    console.log("DEBUG SIGNATURE - path:", path);
    console.log("DEBUG SIGNATURE - timestamp:", timestamp);
    console.log("DEBUG SIGNATURE - accessToken (first 5 chars):", accessToken ? accessToken.substring(0, 5) + '...' : 'N/A');
    console.log("DEBUG SIGNATURE - shopId:", shopId); // Re-adicionado o log do shopId, pois ele é parte da baseString
    console.log("DEBUG SIGNATURE - Partner Key (first 5 and last 5 chars):", 
        SHOPEE_API_KEY_LIVE ? SHOPEE_API_KEY_LIVE.substring(0, 5) + '...' + SHOPEE_API_KEY_LIVE.substring(SHOPEE_API_KEY_LIVE.length - 5) : 'N/A'
    );
    // Mudamos o nome do log para refletir que o shopId ESTÁ na base string
    console.log("DEBUG SIGNATURE - BASE STRING COMPLETA PARA ASSINATURA (COM shopId):", baseString); 
    console.log("DEBUG SIGNATURE - HASH GERADO LOCALMENTE:", crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex'));
    console.log("--- DEBUG SIGNATURE END ---\n");

    return crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');
}

module.exports = {
    generateShopeeAuthLink,
    getAccessTokenFromCode,
    refreshShopeeAccessToken,
    getValidatedShopeeTokens,
    generateShopeeSignature,
};