// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Validação básica para garantir que as variáveis de ambiente do Supabase estão definidas
if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Erro: Variáveis de ambiente do Supabase (SUPABASE_URL, SUPABASE_ANON_KEY) não estão configuradas no .env ou no Render Environment.");
    // Em um ambiente de produção, você pode querer lançar um erro ou encerrar o processo aqui
}

// Variáveis da Shopee
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE;
// RENOMEADO E CRÍTICO: Esta é a chave de APP (APP Key) que deve ser usada para assinar as APIs de DADOS.
// No seu .env e Render, configure como SHOPEE_APP_KEY_LIVE = 5a76716956544151425979695a7844726857745a786856467155736d4178776d
const SHOPEE_APP_KEY_LIVE = process.env.SHOPEE_APP_KEY_LIVE; 
const SHOPEE_AUTH_HOST_LIVE = process.env.SHOPEE_AUTH_HOST_LIVE; 
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE;
const SHOPEE_REDIRECT_URL_LIVE = process.env.SHOPEE_REDIRECT_URL_LIVE; 

// Validação melhorada para garantir que as variáveis de ambiente da Shopee estão definidas
console.log("--- Verificando Variáveis de Ambiente da Shopee ---");
console.log(`SHOPEE_PARTNER_ID_LIVE: ${SHOPEE_PARTNER_ID_LIVE ? 'OK' : 'FALTANDO/INCORRETO'}`);
console.log(`SHOPEE_APP_KEY_LIVE (parcial): ${SHOPEE_APP_KEY_LIVE ? SHOPEE_APP_KEY_LIVE.substring(0, 5) + '...' + SHOPEE_APP_KEY_LIVE.slice(-5) : 'FALTANDO/INCORRETO'}`); // Exibe parcial
console.log(`SHOPEE_API_HOST_LIVE: ${SHOPEE_API_HOST_LIVE ? 'OK' : 'FALTANDO/INCORRETO'}`);
console.log(`SHOPEE_REDIRECT_URL_LIVE: ${SHOPEE_REDIRECT_URL_LIVE ? 'OK' : 'FALTANDO/INCORRETO'}`); 

let shopeeConfigOk = true;
if (!SHOPEE_PARTNER_ID_LIVE) {
    console.error("Erro: SHOPEE_PARTNER_ID_LIVE não está configurado.");
    shopeeConfigOk = false;
}
if (!SHOPEE_APP_KEY_LIVE) { // Agora verifica SHOPEE_APP_KEY_LIVE
    console.error("Erro: SHOPEE_APP_KEY_LIVE não está configurado.");
    shopeeConfigOk = false;
}
if (!SHOPEE_API_HOST_LIVE) {
    console.error("Erro: SHOPEE_API_HOST_LIVE não está configurado.");
    shopeeConfigOk = false;
}
if (!SHOPEE_REDIRECT_URL_LIVE) {
    console.error("Erro: SHOPEE_REDIRECT_URL_LIVE não está configurado.");
    shopeeConfigOk = false;
}

if (!shopeeConfigOk) {
    console.error("--- ERRO: Variáveis de ambiente da Shopee não estão configuradas corretamente. ---");
    // process.exit(1); 
} else {
    console.log("--- Todas as variáveis de ambiente da Shopee estão configuradas corretamente. ---");
}
console.log("------------------------------------------");


/**
 * Obtém o access_token e refresh_token usando o code da Shopee.
 * @param {string} code O código de autorização obtido da Shopee.
 * @param {string} shopId O ID da loja.
 * @returns {Promise<object>} Um objeto contendo access_token, refresh_token e expire_in.
 */
async function getAccessTokenFromCode(code, shopId) {
    const path = "/api/v2/auth/token/get"; 
    const timestamp = Math.floor(Date.now() / 1000);
    const partnerId = Number(SHOPEE_PARTNER_ID_LIVE); 

    const requestBody = {
        code: code,
        shop_id: Number(shopId),
        partner_id: partnerId
    };

    // --- CORREÇÃO CRÍTICA AQUI: Incluir o JSON.stringify(requestBody) na baseString para POST ---
    const requestBodyString = JSON.stringify(requestBody);
    const baseString = `${partnerId}${path}${timestamp}${requestBodyString}`; 
    const sign = crypto.createHmac('sha256', SHOPEE_APP_KEY_LIVE).update(baseString).digest('hex'); // Usa SHOPEE_APP_KEY_LIVE

    console.log(`\n--- DEBUG getAccessTokenFromCode ---`);
    console.log(`[DEBUG] Partner ID: ${partnerId}`);
    console.log(`[DEBUG] Path: ${path}`);
    console.log(`[DEBUG] Timestamp: ${timestamp}`);
    console.log(`[DEBUG] Request Body Original: ${JSON.stringify(requestBody)}`); 
    console.log(`[DEBUG] Request Body Stringified para assinatura: ${requestBodyString}`);
    console.log(`[DEBUG] Base String COMPLETA para assinatura: "${baseString}"`); // Mostrar a base string completa
    console.log(`[DEBUG] Generated Sign: ${sign}`);

    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`; 

    try {
        console.log(`[DEBUG] URL para token: ${url}`);
        console.log(`[DEBUG] Request Body para token (enviado no POST): ${JSON.stringify(requestBody)}`);
        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                // 'Host': new URL(SHOPEE_API_HOST_LIVE).host, // Removido: Geralmente não é necessário e pode causar problemas
            }
        });

        if (response.data.error) {
            console.error(`[SHOPEE_API_ERROR] Resposta de erro da Shopee (token): ${JSON.stringify(response.data)}`);
            throw new Error(response.data.message || 'Erro desconhecido ao obter access token.');
        }
        console.log('[SHOPEE_API_SUCCESS] Resposta getAccessTokenFromCode:', response.data);
        console.log(`--- FIM DEBUG getAccessTokenFromCode ---\n`);
        return {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expire_in: response.data.expire_in
        };
    } catch (error) {
        console.error('\n--- ERRO getAccessTokenFromCode ---');
        console.error('Falha ao obter access token da Shopee.');
        if (error.response) {
            console.error('Status do erro HTTP:', error.response.status);
            console.error('Dados do erro da API Shopee:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('Nenhuma resposta recebida do servidor Shopee. Requisição:', error.request);
        } else {
            console.error('Erro ao configurar a requisição:', error.message);
        }
        console.error('--- FIM ERRO getAccessTokenFromCode ---\n');
        throw new Error(`Falha ao obter access token da Shopee: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}

/**
 * Atualiza o access_token usando o refresh_token.
 */
async function refreshShopeeAccessToken(shopId, refreshToken) {
    const path = "/api/v2/auth/access_token/get"; 
    const timestamp = Math.floor(Date.now() / 1000);
    const partnerId = Number(SHOPEE_PARTNER_ID_LIVE); 

    const requestBody = {
        shop_id: Number(shopId),
        refresh_token: refreshToken,
        partner_id: partnerId
    };

    // --- CORREÇÃO CRÍTICA AQUI: Incluir o JSON.stringify(requestBody) na baseString para POST ---
    const requestBodyString = JSON.stringify(requestBody);
    const baseString = `${partnerId}${path}${timestamp}${requestBodyString}`;
    const sign = crypto.createHmac('sha256', SHOPEE_APP_KEY_LIVE).update(baseString).digest('hex'); // Usa SHOPEE_APP_KEY_LIVE

    console.log(`\n--- DEBUG refreshShopeeAccessToken ---`);
    console.log(`[DEBUG] Partner ID: ${partnerId}`);
    console.log(`[DEBUG] Path: ${path}`);
    console.log(`[DEBUG] Timestamp: ${timestamp}`);
    console.log(`[DEBUG] Request Body Original (Refresh): ${JSON.stringify(requestBody)}`); 
    console.log(`[DEBUG] Request Body Stringified para assinatura (Refresh): ${requestBodyString}`);
    console.log(`[DEBUG] Base String COMPLETA para assinatura (Refresh): "${baseString}"`);
    console.log(`[DEBUG] Generated Sign (Refresh): ${sign}`);

    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

    try {
        console.log(`[DEBUG] URL para refresh token: ${url}`);
        console.log(`[DEBUG] Request Body para refresh token (enviado no POST): ${JSON.stringify(requestBody)}`);
        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                // 'Host': new URL(SHOPEE_API_HOST_LIVE).host, // Removido
            }
        });

        if (response.data.error) {
            console.error(`[SHOPEE_API_ERROR] Resposta de erro da Shopee (refresh token): ${JSON.stringify(response.data)}`);
            throw new Error(response.data.message || 'Erro desconhecido ao refrescar access token.');
        }
        console.log('[SHOPEE_API_SUCCESS] Resposta refreshShopeeAccessToken:', response.data);
        console.log(`--- FIM DEBUG refreshShopeeAccessToken ---\n`);
        return {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expire_in: response.data.expire_in
        };
    } catch (error) {
        console.error('\n--- ERRO refreshShopeeAccessToken ---');
        console.error('Falha ao refrescar access token da Shopee.');
        if (error.response) {
            console.error('Status do erro HTTP:', error.response.status);
            console.error('Dados do erro da API Shopee:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('Nenhuma resposta recebida do servidor Shopee. Requisição:', error.request);
        } else {
            console.error('Erro ao configurar a requisição:', error.message);
        }
        console.error('--- FIM ERRO refreshShopeeAccessToken ---\n');
        throw new Error(`Falha ao refrescar access token da Shopee: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}

// --- Rotas da API ---

// Rota raiz - para verificar se o servidor está rodando
router.get('/', (req, res) => {
    res.status(200).send('Servidor BI Marketplace Integrator rodando! Use /auth/shopee/callback para autorização.');
});

// Endpoint de Callback da Shopee - Onde a Shopee redireciona APÓS a autorização
router.get('/auth/shopee/callback', async (req, res) => {
    const { code, shop_id } = req.query;

    if (!code || !shop_id) {
        console.error('[API_ROUTE] Callback da Shopee sem code ou shop_id.');
        return res.status(400).send('Erro: Parâmetros de callback ausentes.');
    }

    console.log(`\n--- ROTA /auth/shopee/callback ---`);
    console.log(`[API_ROUTE] Endpoint /auth/shopee/callback acionado para Shop ID: ${shop_id}. CODE recebido: ${code}`);

    const partnerId = Number(SHOPEE_PARTNER_ID_LIVE);
    const appKey = SHOPEE_APP_KEY_LIVE; // Usa SHOPEE_APP_KEY_LIVE
    const redirectUrl = SHOPEE_REDIRECT_URL_LIVE; 
    const apiHost = SHOPEE_API_HOST_LIVE;

    if (!partnerId || !appKey || !redirectUrl || !apiHost) {
        console.error("Erro: Variáveis de ambiente da Shopee não estão configuradas corretamente no contexto da rota de callback.");
        return res.status(500).send("Erro de configuração do servidor.");
    }

    try {
        const tokens = await getAccessTokenFromCode(code, shop_id);

        // === SALVAR OS TOKENS NO SUPABASE ===
        if (!shop_id || isNaN(Number(shop_id)) || !partnerId || isNaN(Number(partnerId))) {
            console.error('❌ [API_ROUTE] shop_id ou partner_id inválidos antes do upsert no Supabase.');
            return res.status(500).send('Erro: IDs inválidos para salvar tokens.');
        }

        const { data, error: upsertError } = await supabase
            .from('api_connections_shopee')
            .upsert(
                {
                    shop_id: Number(shop_id),
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: new Date(Date.now() + tokens.expire_in * 1000).toISOString(),
                    last_updated_at: new Date().toISOString(),
                    partner_id: Number(partnerId)
                },
                { onConflict: 'shop_id' }
            );

        if (upsertError) {
            console.error('❌ [API_ROUTE] Erro ao salvar tokens no Supabase:', upsertError.message);
            return res.status(500).json({ error: 'Erro ao salvar tokens no Supabase', details: upsertError.message });
        } else {
            console.log(`✅ [API_ROUTE] Tokens salvos/atualizados no Supabase para Shop ID: ${shop_id}.`);
        }

        res.status(200).json({
            message: 'Access Token e Refresh Token obtidos e salvos no banco de dados com sucesso! Copie os valores abaixo para testes manuais.',
            shopId: shop_id,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expire_in
        });
        console.log(`--- FIM ROTA /auth/shopee/callback ---\n`);

    } catch (error) {
        console.error('❌ [API_ROUTE] Erro ao obter access token da Shopee via rota de callback:', error.message);
        res.status(500).send(`Erro ao obter access token da Shopee: ${error.message}`);
        console.log(`--- FIM ROTA /auth/shopee/callback com Erro ---\n`);
    }
});


// Endpoint para buscar e salvar pedidos brutos da Shopee
router.get('/auth/shopee/fetch-orders', async (req, res) => {
    const { shopId } = req.query;

    if (!shopId) {
        return res.status(400).json({ error: 'shopId é obrigatório na query.' });
    }

    console.log(`\n--- ROTA /auth/shopee/fetch-orders ---`);
    console.log(`[API_ROUTE] Endpoint /shopee/fetch-orders acionado para Shop ID: ${shopId}.`);

    try {
        const { data: connectionData, error: fetchError } = await supabase
            .from('api_connections_shopee')
            .select('access_token, refresh_token, token_expires_at')
            .eq('shop_id', shopId)
            .single();

        if (fetchError || !connectionData) {
            console.error('❌ [API_ROUTE] Erro ao buscar tokens no Supabase:', fetchError ? fetchError.message : 'Tokens não encontrados.');
            return res.status(404).json({ error: 'Tokens não encontrados para o shopId fornecido. Por favor, autorize a loja primeiro.' });
        }

        let accessToken = connectionData.access_token;
        let refreshToken = connectionData.refresh_token;
        const expiresAt = new Date(connectionData.token_expires_at);
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
                        token_expires_at: newExpiresAt.toISOString()
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
        const partnerId = Number(SHOPEE_PARTNER_ID_LIVE);

        // Assinatura para get_order_list (GET) - Esta já estava correta
        const baseStringOrderList = `${partnerId}${ordersPath}${timestamp}${accessToken}${Number(shopId)}`;
        const signatureOrderList = crypto.createHmac('sha256', SHOPEE_APP_KEY_LIVE).update(baseStringOrderList).digest('hex'); // Usa SHOPEE_APP_KEY_LIVE

        // Construindo a URL para a requisição GET
        const ordersUrl = `${SHOPEE_API_HOST_LIVE}${ordersPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${signatureOrderList}&access_token=${accessToken}&shop_id=${shopId}&order_status=READY_TO_SHIP&page_size=10`;

        console.log(`[SHOPEE_API] Chamando: ${ordersUrl}`);

        const shopeeResponse = await axios.get(ordersUrl, {
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
        console.log(`--- FIM ROTA /auth/shopee/fetch-orders ---\n`);

    } catch (error) {
        console.error('❌ [API_ROUTE] Erro na busca de pedidos:', error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).json({ error: 'Falha ao buscar pedidos da Shopee.', details: error.response ? JSON.stringify(error.response.data) : error.message });
        console.log(`--- FIM ROTA /auth/shopee/fetch-orders com Erro ---\n`);
    }
});


// Endpoint para normalizar pedidos brutos para a tabela orders_detail_normalized
router.get('/auth/shopee/normalize', async (req, res) => {
    console.log('\n--- ROTA /auth/shopee/normalize ---');
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
                    // CORREÇÃO: Certifique-se de que liquid_value está sendo calculado corretamente
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
        console.log(`--- FIM ROTA /auth/shopee/normalize ---\n`);

    } catch (error) {
        console.error('❌ [NORMALIZER] Erro geral no processo de normalização:', error.message);
        res.status(500).json({ error: 'Falha no processo de normalização de pedidos.', details: error.message });
        console.log(`--- FIM ROTA /auth/shopee/normalize com Erro ---\n`);
    }
});

module.exports = router;