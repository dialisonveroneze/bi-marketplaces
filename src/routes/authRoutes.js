// src/routes/authRoutes.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config(); // Garante que as variáveis de ambiente sejam carregadas

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const router = express.Router();

// --- Variáveis de Ambiente ---
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE;
const SHOPEE_AUTH_HOST_LIVE = process.env.SHOPEE_AUTH_HOST_LIVE;
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE;

// --- Funções Auxiliares (como em src/utils/security.js) ---

/**
 * Gera a assinatura HMAC-SHA256 para requisições da Shopee API.
 * @param {string} path O caminho da API (ex: "/api/v2/auth/token/get").
 * @param {object} params Parâmetros da requisição (query ou body).
 * @param {number} timestamp O timestamp Unix.
 * @returns {string} A assinatura hexadecimal.
 */
function generateShopeeSignature(path, params, timestamp) {
    let baseString = `<span class="math-inline">\{SHOPEE\_PARTNER\_ID\_LIVE\}</span>{path}${timestamp}`;

    // Parâmetros específicos da API para inclusão na base string, se existirem
    // A ordem importa: partner_id, api path, timestamp, access_token, shop_id
    // Para token/get, geralmente não tem access_token ainda, e shop_id é no body.
    // Para outras APIs, se tiver access_token e shop_id no common parameters, eles iriam aqui.

    // Apenas para garantir que o 'code' ou 'refresh_token' não sejam incluídos na string base do HMAC
    // Eles são parte do body, não da string de assinatura para 'common parameters'
    const sortedKeys = Object.keys(params).sort();
    const sortedParams = {};
    for (const key of sortedKeys) {
        sortedParams[key] = params[key];
    }
    
    // Concatena os parâmetros na ordem correta, se aplicável, para a string base.
    // Para auth/token/get e auth/access_token/get, os parâmetros do corpo
    // (code, shop_id, refresh_token) não são parte da string base do HMAC para SIGN.
    // A string base para SIGN é simplesmente: partner_id + api_path + timestamp
    // conforme a documentação para Common Parameters (primeiro nível).
    // O trecho abaixo foi adaptado para focar apenas na assinatura inicial (path, timestamp, partner_id)
    // para a chamada de token/get, conforme a doc da Shopee.

    const sign = crypto.createHHmac('sha256', SHOPEE_API_KEY_LIVE)
        .update(baseString)
        .digest('hex');
    return sign;
}


/**
 * Obtém o access_token e refresh_token usando o code da Shopee.
 * @param {string} code O código de autorização obtido da Shopee.
 * @param {string} shopId O ID da loja.
 * @returns {Promise<object>} Um objeto contendo access_token, refresh_token e expire_in.
 */
async function getAccessTokenFromCode(code, shopId) {
    const path = "/api/v2/auth/token/get";
    const timestamp = Math.floor(Date.now() / 1000);
    
    const body = {
        code: code,
        shop_id: Number(shopId), // Certifique-se de que é um número
        partner_id: Number(SHOPEE_PARTNER_ID_LIVE) // Certifique-se de que é um número
    };

    const signature = generateShopeeSignature(path, {}, timestamp); // Não passa body params para a assinatura inicial

    const url = `<span class="math-inline">\{SHOPEE\_API\_HOST\_LIVE\}</span>{path}?partner_id=<span class="math-inline">\{SHOPEE\_PARTNER\_ID\_LIVE\}&timestamp\=</span>{timestamp}&sign=${signature}`;

    try {
        const response = await axios.post(url, body, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.data.error) {
            throw new Error(response.data.message || 'Erro desconhecido ao obter access token.');
        }
        console.log('[SHOPEE_API] Resposta getAccessTokenFromCode:', response.data);
        return {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expire_in: response.data.expire_in 
        };
    } catch (error) {
        console.error('Erro na requisição getAccessTokenFromCode:', error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Falha ao obter access token da Shopee: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}

/**
 * Atualiza o access_token usando o refresh_token.
 * @param {string} shopId O ID da loja.
 * @param {string} refreshToken O refresh_token atual.
 * @returns {Promise<object>} Um objeto contendo o novo access_token, refresh_token e expire_in.
 */
async function refreshShopeeAccessToken(shopId, refreshToken) {
    const path = "/api/v2/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);
    
    const body = {
        shop_id: Number(shopId),
        refresh_token: refreshToken,
        partner_id: Number(SHOPEE_PARTNER_ID_LIVE)
    };

    const signature = generateShopeeSignature(path, {}, timestamp); // Não passa body params para a assinatura

    const url = `<span class="math-inline">\{SHOPEE\_API\_HOST\_LIVE\}</span>{path}?partner_id=<span class="math-inline">\{SHOPEE\_PARTNER\_ID\_LIVE\}&timestamp\=</span>{timestamp}&sign=${signature}`;

    try {
        const response = await axios.post(url, body, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.data.error) {
            throw new Error(response.data.message || 'Erro desconhecido ao refrescar access token.');
        }
        console.log('[SHOPEE_API] Resposta refreshShopeeAccessToken:', response.data);
        return {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expire_in: response.data.expire_in 
        };
    } catch (error) {
        console.error('Erro na requisição refreshShopeeAccessToken:', error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Falha ao refrescar access token da Shopee: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}


// --- Rotas da API ---

// Rota raiz - para verificar se o servidor está rodando
router.get('/', (req, res) => {
    res.status(200).send('Servidor BI Marketplace Integrator rodando! Use /auth/shopee/callback para autorização.');
});


// Endpoint de Callback da Shopee - Onde a Shopee redireciona após a autorização
router.get('/auth/shopee/callback', async (req, res) => {
    const { code, shop_id } = req.query; 

    if (code && shop_id) {
        console.log(`[API_ROUTE] Endpoint /auth/shopee/callback acionado com code e shop_id para Shop ID: ${shop_id}`);
        try {
            const tokens = await getAccessTokenFromCode(code, shop_id);

            // === SALVAR OS TOKENS NO SUPABASE ===
            const { data, error: upsertError } = await supabase
                .from('api_connections_shopee')
                .upsert({
                    connection_id: 1, // ID fixo ou gerado, dependendo da sua necessidade
                    shop_id: Number(shop_id), 
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expires_at: new Date(Date.now() + tokens.expire_in * 1000).toISOString(), 
                    partner_id: SHOPEE_PARTNER_ID_LIVE // Salva o partner_id usado
                }, { onConflict: 'shop_id' }); // Conflito no shop_id para atualizar se já existir

            if (upsertError) {
                console.error('❌ [API_ROUTE] Erro ao salvar tokens no Supabase:', upsertError.message);
                return res.status(500).json({ error: 'Erro ao salvar tokens no Supabase', details: upsertError.message });
            } else {
                console.log(`✅ [API_ROUTE] Tokens salvos/atualizados no Supabase para Shop ID: ${shop_id}.`);
            }
            // ===========================================

            res.status(200).json({
                message: 'Access Token e Refresh Token obtidos e salvos no banco de dados com sucesso! Copie os valores abaixo para testes manuais.',
                shopId: shop_id,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresIn: tokens.expire_in 
            });
        } catch (error) {
            console.error('❌ [API_ROUTE] Erro ao obter access token da Shopee via rota de callback:', error.message);
            res.status(500).json({ error: 'Erro ao obter access token da Shopee', details: error.message });
        }
    } else {
        console.log('[API_ROUTE] Parâmetros code ou shop_id ausentes na requisição de callback.');
        res.status(400).json({ error: 'Parâmetros code ou shop_id ausentes. A autorização pode não ter sido bem-sucedida.' });
    }
});


// Endpoint para buscar e salvar pedidos brutos da Shopee
router.get('/auth/shopee/fetch-orders', async (req, res) => {
    const { shopId } = req.query; // Puxar shopId da query para flexibilidade

    if (!shopId) {
        return res.status(400).json({ error: 'shopId é obrigatório na query.' });
    }

    console.log(`[API_ROUTE] Endpoint /shopee/fetch-orders acionado para Shop ID: ${shopId}.`);

    try {
        // 1. Obter tokens do Supabase para o shopId
        const { data: connectionData, error: fetchError } = await supabase
            .from('api_connections_shopee')
            .select('access_token, refresh_token, expires_at')
            .eq('shop_id', shopId)
            .single();

        if (fetchError || !connectionData) {
            console.error('❌ [API_ROUTE] Erro ao buscar tokens no Supabase:', fetchError ? fetchError.message : 'Tokens não encontrados.');
            return res.status(404).json({ error: 'Tokens não encontrados para o shopId fornecido. Por favor, autorize a