// src/routes/authRoutes.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
// Remova require('dotenv').config(); daqui, ele já está em server.js

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase (acessa diretamente process.env, que já foi carregado por server.js)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const router = express.Router();

// --- Variáveis da Shopee (acessa diretamente process.env, que já foi carregado por server.js) ---
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE;
const SHOPEE_AUTH_HOST_LIVE = process.env.SHOPEE_AUTH_HOST_LIVE;
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE;

// --- Funções Auxiliares de Segurança e API (permanecem as mesmas) ---

/**
 * Gera a assinatura HMAC-SHA256 para requisições da Shopee API.
 * @param {string} path O caminho da API (ex: "/api/v2/auth/token/get").
 * @param {object} params Parâmetros da requisição (query ou body).
 * @param {number} timestamp O timestamp Unix.
 * @returns {string} A assinatura hexadecimal.
 */
function generateShopeeSignature(path, params, timestamp) {
    let baseString = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE)
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
        shop_id: Number(shopId),
        partner_id: Number(SHOPEE_PARTNER_ID_LIVE)
    };

    const signature = generateShopeeSignature(path, {}, timestamp); 

    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${signature}`;

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

    const signature = generateShopeeSignature(path, {}, timestamp); 

    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${signature}`;

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
// Esta rota responderá quando o acesso for simplesmente https://bi-marketplaces.onrender.com/
router.get('/', (req, res) => {
    res.status(200).send('Servidor BI Marketplace Integrator rodando! Use /auth/shopee/callback para autorização.');
});

// Endpoint de Callback da Shopee - Onde a Shopee redireciona APÓS a autorização
// Esta rota agora escuta no caminho /auth/shopee/callback
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
                    connection_id: 1, 
                    shop_id: Number(shop_id), 
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expires_at: new Date(Date.now() + tokens.expire_in * 1000).toISOString(), 
                    partner_id: SHOPEE_PARTENER_ID_LIVE 
                }, { onConflict: 'shop_id' }); 

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
        console.log('[API_ROUTE] Parâmetros code ou shop_id ausentes na requisição de callback. Esta rota espera um callback da Shopee.');
        res.status(400).json({ error: 'Parâmetros code ou shop_id ausentes. A autorização pode não ter sido bem-sucedida.' });
    }
});


// Endpoint para buscar e salvar pedidos brutos da Shopee
router.get('/auth/shopee/fetch-orders', async (req, res) => {
    const { shopId } = req.query; 

    if (!shopId) {
        return res.status(400).json({ error: 'shopId é obrigatório na query.' });
    }

    console.log(`[API_ROUTE] Endpoint /shopee/fetch-orders acionado para Shop ID: ${shopId}.`);

    try {
        const { data: connectionData, error: fetchError } = await supabase
            .from('api_connections_shopee')
            .select('access_token, refresh_token, expires_at')
            .eq('shop_id', shopId)
            .single();

        if (fetchError || !connectionData) {
            console.error('❌ [API_ROUTE] Erro ao buscar tokens no Supabase:', fetchError ? fetchError.message : 'Tokens não encontrados.');
            return res.status(404).json({ error: 'Tokens não encontrados para o shopId fornecido. Por favor, autorize a loja primeiro.' });
        }

        let accessToken = connectionData.access_token;
        let refreshToken = connectionData.refresh_token;
        const expiresAt = new Date(connectionData.expires_at);
        const now = new Date();

        if (now >= expiresAt) {
            console.log(`🔄 [API_ROUTE] Access Token para Shop ID: ${shopId} expirado. Tentando refrescar...`);
            try {
                const newTokens = await refreshShopeeAccessToken(shopId, refreshToken);
                accessToken = newTokens.access_token;
                refreshToken = newTokens.refresh_token; 
                const newExpiresAt = new Date(Date.now() + newTokens.expire_in * 1000);

                const { error: updateError } = await supabase
                    .from('api_connections_shopee')
                    .upsert({
                        shop_id: Number(shopId), 
                        access_token: accessToken,
                        refresh_token: refreshToken,
                        expires_at: newExpiresAt.toISOString()
                    }, { onConflict: 'shop_id' });

                if (updateError) {
                    console.error('❌ [API_ROUTE] Erro ao atualizar tokens no Supabase após refresh:', updateError.message);
                } else {
                    console.log(`✅ [API_ROUTE] Tokens para Shop ID: ${shopId} refrescados e atualizados no Supabase.`);
                }

            } catch (refreshError) {
                console.error('❌ [API_ROUTE] Falha ao refrescar Access Token:', refreshError.message);
                return res.status(500).json({ error: 'Falha ao refrescar Access Token. Por favor, tente autorizar a loja novamente.', details: refreshError.message });
            }
        }

        const ordersPath = "/api/v2/order/get_order_list";
        const timestamp = Math.floor(Date.now() / 1000);

        const orderParams = {
            shop_id: Number(shopId),
            partner_id: Number(SHOPEE_PARTNER_ID_LIVE),
            timestamp: timestamp,
            access_token: accessToken, 
            order_status: 'READY_TO_SHIP', 
            page_size: 10 
        };

        const signature = generateShopeeSignature(ordersPath, orderParams, timestamp);

        const ordersUrl = `${SHOPEE_API_HOST_LIVE}${ordersPath}?partner_id=${SHOPEE_PARTNER_ID_LIVE}&timestamp=${timestamp}&sign=${signature}&access_token=${accessToken}&shop_id=${shopId}`;
        let finalOrdersUrl = ordersUrl;
        Object.keys(orderParams).forEach(key => {
            if (!['shop_id', 'partner_id', 'timestamp', 'access_token', 'sign'].includes(key)) {
                finalOrdersUrl += `&${key}=${orderParams[key]}`;
            }
        });

        console.log(`[SHOPEE_API] Chamando: ${finalOrdersUrl}`);

        const shopeeResponse = await axios.get(finalOrdersUrl, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (shopeeResponse.data.error) {
            throw new Error(shopeeResponse.data.message || 'Erro desconhecido ao buscar pedidos.');
        }

        const orders = shopeeResponse.data.response.order_list;
        console.log(`[API_ROUTE] ${orders.length} pedidos encontrados para Shop ID: ${shopId}.`);

        if (orders.length > 0) {
            const ordersToInsert = orders.map(order => ({
                order_sn: order.order_sn,
                shop_id: Number(shopId),
                original_data: order, 
                retrieved_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabase
                .from('orders_raw_shopee')
                .upsert(ordersToInsert, { onConflict: 'order_sn' }); 

            if (insertError) {
                console.error('❌ [API_ROUTE] Erro ao salvar pedidos brutos no Supabase:', insertError.message);
                return res.status(500).json({ error: 'Erro ao salvar pedidos brutos no Supabase', details: insertError.message });
            } else {
                console.log(`✅ [API_ROUTE] ${orders.length} pedidos brutos salvos/atualizados em orders_raw_shopee para Shop ID: ${shopId}.`);
                res.status(200).json({ message: 'Pedidos brutos buscados e salvos com sucesso!', count: orders.length });
            }
        } else {
            console.log(`[API_ROUTE] Nenhuns pedidos encontrados para Shop ID: ${shopId}.`);
            res.status(200).json({ message: 'Nenhuns pedidos encontrados para o status e período especificados.', count: 0 });
        }

    } catch (error) {
        console.error('❌ [API_ROUTE] Erro na busca de pedidos:', error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).json({ error: 'Falha ao buscar pedidos da Shopee.', details: error.response ? JSON.stringify(error.response.data) : error.message });
    }
});


// Endpoint para normalizar pedidos brutos para a tabela orders_detail_normalized
router.get('/auth/shopee/normalize', async (req, res) => {
    console.log('[API_ROUTE] Endpoint /shopee/normalize acionado.');

    const clientId = req.query.clientId || 1; 

    console.log(`[DEBUG_NORMALIZER] Iniciando normalização para client_id: ${clientId}`);

    try {
        const { data: rawOrders, error: fetchRawError } = await supabase
            .from('orders_raw_shopee')
            .select('*'); 

        if (fetchRawError) {
            console.error('❌ [NORMALIZER] Erro ao buscar pedidos brutos:', fetchRawError.message);
            return res.status(500).json({ error: 'Erro ao buscar pedidos brutos para normalização', details: fetchRawError.message });
        }

        if (!rawOrders || rawOrders.length === 0) {
            console.log('[NORMALIZER] Nenhuns pedidos brutos para normalizar.');
            return res.status(200).json({ message: 'Nenhuns pedidos brutos para normalizar.', normalizedCount: 0 });
        }

        const normalizedOrders = [];
        const updateRawStatus = [];

        for (const rawOrder of rawOrders) {
            const originalData = rawOrder.original_data;

            if (!originalData) {
                console.warn(`[NORMALIZER] Pedido SN: ${rawOrder.order_sn} não tem 'original_data'. Pulando.`);
                continue;
            }

            try {
                const totalAmount = parseFloat(originalData.total_amount) || 0;
                const shippingFee = parseFloat(originalData.actual_shipping_fee) || 0; 
                
                const liquidValue = totalAmount - shippingFee; 

                const normalizedData = {
                    client_id: clientId, 
                    platform_id: 1, 
                    order_sn: originalData.order_sn,
                    order_status: originalData.order_status,
                    total_amount: totalAmount,
                    shipping_fee: shippingFee,
                    liquid_value: liquidValue,
                    currency: originalData.currency,
                    created_at: new Date(originalData.create_time * 1000).toISOString(), 
                    updated_at: new Date(originalData.update_time * 1000).toISOString(),
                    recipient_name: originalData.recipient_address ? originalData.recipient_address.name : null,
                    recipient_phone: originalData.recipient_address ? originalData.recipient_address.phone : null,
                    shipping_carrier: originalData.shipping_carrier,
                    payment_method: originalData.payment_method,
                    buyer_username: originalData.buyer_username,
                    shop_id: originalData.shop_id,
                };
                normalizedOrders.push(normalizedData);

                updateRawStatus.push(rawOrder.order_sn);

            } catch (parseError) {
                console.error(`❌ [NORMALIZER] Erro ao normalizar pedido SN: ${rawOrder.order_sn}. Erro: ${parseError.message}`);
            }
        }

        if (normalizedOrders.length > 0) {
            const { error: insertNormalizedError } = await supabase
                .from('orders_detail_normalized')
                .upsert(normalizedOrders, { onConflict: 'order_sn' }); 

            if (insertNormalizedError) {
                console.error('❌ [NORMALIZER] Erro ao salvar pedidos normalizados no Supabase:', insertNormalizedError.message);
                return res.status(500).json({ error: 'Erro ao salvar pedidos normalizados', details: insertNormalizedError.message });
            } else {
                console.log(`✅ [NORMALIZER] ${normalizedOrders.length} pedidos normalizados e salvos em orders_detail_normalized.`);
                
                res.status(200).json({ message: 'Pedidos normalizados com sucesso!', normalizedCount: normalizedOrders.length });
            }
        } else {
            console.log('[NORMALIZER] Nenhuns pedidos foram processados para normalização.');
            res.status(200).json({ message: 'Nenhuns pedidos foram processados para normalização.', normalizedCount: 0 });
        }

    } catch (error) {
        console.error('❌ [NORMALIZER] Erro geral no processo de normalização:', error.message);
        res.status(500).json({ error: 'Falha no processo de normalização de pedidos.', details: error.message });
    }
});

module.exports = router;