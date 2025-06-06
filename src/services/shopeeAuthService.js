// src/services/shopeeAuthService.js
const axios = require('axios');
const crypto = require('crypto'); // Certifique-se de que o 'crypto' está importado
const shopeeConfig = require('../config/shopeeConfig');
const supabase = require('../config/supabase');

const {
    SHOPEE_API_HOST_LIVE,
    SHOPEE_PARTNER_ID_LIVE,
    SHOPEE_API_KEY_LIVE, // Necessário aqui para o HMAC
    SHOPEE_REDIRECT_URL
} = shopeeConfig;

// Função principal de geração de assinatura para APIs que usam access_token e shop_id
function generateShopeeSignature(path, partnerId, timestamp, accessToken, shopId) {
    // A baseString é a concatenação dos parâmetros na ordem especificada PELA SHOPEE.
    // A Partner Key (SHOPEE_API_KEY_LIVE) NÃO VAI NA BASE_STRING.
    // Ela é a CHAVE SECRETA para o HMAC.
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    
    // DEBUG: Log the baseString to verify its composition
    console.log(`--- DEBUG SIGNATURE START ---`);
    console.log(`DEBUG SIGNATURE - partnerId: ${partnerId}`);
    console.log(`DEBUG SIGNATURE - path: ${path}`);
    console.log(`DEBUG SIGNATURE - timestamp: ${timestamp}`);
    console.log(`DEBUG SIGNATURE - accessToken (first 5 chars): ${accessToken.substring(0, 5)}...`);
    console.log(`DEBUG SIGNATURE - shopId: ${shopId}`);
    console.log(`DEBUG SIGNATURE - Partner Key (first 5 and last 5 chars): ${SHOPEE_API_KEY_LIVE.substring(0, 5)}...${SHOPEE_API_KEY_LIVE.slice(-5)}`);
    console.log(`DEBUG SIGNATURE - BASE STRING COMPLETA PARA ASSINATURA (SEM Partner Key): ${baseString}`);

    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');
    
    console.log(`DEBUG SIGNATURE - HASH GERADO LOCALMENTE: ${sign}`);
    console.log(`--- DEBUG SIGNATURE END ---`);

    return sign;
}

// --- FUNÇÃO DE OBTENÇÃO DE TOKEN VIA CÓDIGO ---
// (API: /api/v2/auth/token_03)
async function getAccessTokenFromCode(code, shopId, mainAccountId) {
    console.log(`[AuthService:getAccessTokenFromCode] Tentando obter Access Token via código: ${code} para shopId: ${shopId}`);
    const path = "/api/v2/auth/token_03";
    const timestamp = Math.floor(Date.now() / 1000);

    // BASE STRING CORRIGIDA: partner_id + api_path + timestamp + code
    const baseString = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}${code}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');

    const headers = { 'Content-Type': 'application/json' };
    const body = {
        code: code,
        shop_id: shopId,
        partner_id: SHOPEE_PARTNER_ID_LIVE,
    };
    
    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${sign}`;

    try {
        const response = await axios.post(url, body, { headers });
        console.log('[AuthService:getAccessTokenFromCode] Resposta da Shopee (getAccessTokenFromCode):', response.data);
        if (response.data.access_token) {
            // Salvar no Supabase
            const { error } = await supabase
                .from('shopee_connections')
                .upsert({
                    shop_id: shopId,
                    main_account_id: mainAccountId,
                    access_token: response.data.access_token,
                    refresh_token: response.data.refresh_token,
                    expire_time: new Date((response.data.expire_in + timestamp) * 1000).toISOString(),
                    last_updated: new Date().toISOString()
                }, { onConflict: 'shop_id' }); // Conflito no shop_id para atualização

            if (error) {
                console.error('[AuthService:getAccessTokenFromCode] Erro ao salvar tokens no Supabase:', error.message);
                throw new Error(`Erro ao salvar tokens: ${error.message}`);
            }
            console.log('[AuthService:getAccessTokenFromCode] Tokens salvos com sucesso no Supabase.');
            return {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                shop_id: shopId,
                expire_time: response.data.expire_in + timestamp
            };
        } else {
            throw new Error('Falha ao obter access token: ' + (response.data.message || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('[AuthService:getAccessTokenFromCode] Erro na requisição de token:', error.response ? error.response.data : error.message);
        throw new Error('Erro ao obter access token da Shopee.');
    }
}

// --- FUNÇÃO DE REFRESH DE TOKEN ---
// (API: /api/v2/auth/access_token)
async function refreshShopeeAccessToken(refreshToken, shopId, mainAccountId) {
    console.log(`[AuthService:refreshShopeeAccessToken] Tentando refrescar Access Token para shopId: ${shopId}`);
    const path = "/api/v2/auth/access_token";
    const timestamp = Math.floor(Date.now() / 1000);

    // BASE STRING CORRIGIDA: partner_id + api_path + timestamp + refresh_token
    const baseString = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}${refreshToken}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');

    const headers = { 'Content-Type': 'application/json' };
    const body = {
        refresh_token: refreshToken,
        shop_id: shopId,
        partner_id: SHOPEE_PARTNER_ID_LIVE,
    };
    
    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${sign}`;

    try {
        const response = await axios.post(url, body, { headers });
        console.log('[AuthService:refreshShopeeAccessToken] Resposta da Shopee (refreshShopeeAccessToken):', response.data);
        if (response.data.access_token) {
            // Salvar no Supabase
            const { error } = await supabase
                .from('shopee_connections')
                .upsert({
                    shop_id: shopId,
                    main_account_id: mainAccountId,
                    access_token: response.data.access_token,
                    refresh_token: response.data.refresh_token,
                    expire_time: new Date((response.data.expire_in + timestamp) * 1000).toISOString(),
                    last_updated: new Date().toISOString()
                }, { onConflict: 'shop_id' });

            if (error) {
                console.error('[AuthService:refreshShopeeAccessToken] Erro ao salvar tokens no Supabase:', error.message);
                throw new Error(`Erro ao salvar tokens: ${error.message}`);
            }
            console.log('[AuthService:refreshShopeeAccessToken] Tokens refrescados e salvos com sucesso no Supabase.');
            return {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                shop_id: shopId,
                expire_time: response.data.expire_in + timestamp
            };
        } else {
            throw new Error('Falha ao refrescar token: ' + (response.data.message || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('[AuthService:refreshShopeeAccessToken] Erro na requisição de refresh token:', error.response ? error.response.data : error.message);
        throw new Error('Erro ao refrescar token da Shopee.');
    }
}


// --- FUNÇÃO DE OBTENÇÃO E VALIDAÇÃO DE TOKENS (usada pelo orderService) ---
async function getValidatedShopeeTokens(id, idType) {
    console.log(`[AuthService:getValidatedShopeeTokens] Buscando tokens no Supabase para ${idType}: ${id}`);
    try {
        let query;
        if (idType === 'shop_id') {
            query = supabase.from('shopee_connections').select('*').eq('shop_id', id).single();
        } else if (idType === 'main_account_id') {
            query = supabase.from('shopee_connections').select('*').eq('main_account_id', id).single();
        } else {
            throw new Error('Tipo de ID inválido. Use "shop_id" ou "main_account_id".');
        }

        let { data: connectionInfo, error } = await query;

        if (error && error.code === 'PGRST116') { // No rows found
            console.warn(`[AuthService:getValidatedShopeeTokens] Nenhuma conexão encontrada para ${idType}: ${id}.`);
            return null;
        } else if (error) {
            console.error('[AuthService:getValidatedShopeeTokens] Erro ao buscar tokens no Supabase:', error.message);
            throw error;
        }

        if (!connectionInfo) {
            return null; // Não encontrou a conexão
        }

        const currentTime = new Date();
        const expireTime = new Date(connectionInfo.expire_time);

        console.log('[AuthService:getValidatedShopeeTokens] Token atual para ' + idType + ': ' + id);
        console.log('  Access Token (primeiros 5 caracteres): ' + (connectionInfo.access_token ? connectionInfo.access_token.substring(0, 5) + '...' : 'N/A'));
        console.log('  Refresh Token (primeiros 5 caracteres): ' + (connectionInfo.refresh_token ? connectionInfo.refresh_token.substring(0, 5) + '...' : 'N/A'));
        console.log('  Expira em: ' + expireTime.toISOString() + ' (Agora: ' + currentTime.toISOString() + ')');

        // Verifica se o token expirou (dando uma margem de segurança de 5 minutos, por exemplo)
        if (expireTime.getTime() - currentTime.getTime() <= 5 * 60 * 1000) { // Se faltarem 5 minutos ou menos para expirar
            console.warn('[AuthService:getValidatedShopeeTokens] Access Token expirado ou próximo de expirar. Tentando refrescar...');
            const newTokens = await refreshShopeeAccessToken(connectionInfo.refresh_token, connectionInfo.shop_id, connectionInfo.main_account_id);
            console.log('✅ [AuthService:getValidatedShopeeTokens] Access Token refrescado com sucesso.');
            return {
                ...newTokens,
                shop_id: connectionInfo.shop_id, // Garante que shop_id esteja presente
                main_account_id: connectionInfo.main_account_id // Garante que main_account_id esteja presente
            };
        } else {
            console.log(`✅ [AuthService:getValidatedShopeeTokens] Access Token para ${idType}: ${id} ainda válido.`);
            return connectionInfo;
        }
    } catch (error) {
        console.error('[AuthService:getValidatedShopeeTokens] Erro no fluxo de validação/refresh de tokens:', error.message);
        throw error;
    } finally {
        console.log('--- [AuthService:getValidatedShopeeTokens] FIM DA VALIDAÇÃO ---');
    }
}


module.exports = {
    generateShopeeSignature,
    getAccessTokenFromCode,
    refreshShopeeAccessToken,
    getValidatedShopeeTokens
};