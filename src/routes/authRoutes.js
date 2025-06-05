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
    process.exit(1);
}

// Variáveis da Shopee
// Adicionado .trim() para remover espaços em branco indesejados
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE ? process.env.SHOPEE_PARTNER_ID_LIVE.trim() : undefined;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE ? process.env.SHOPEE_API_KEY_LIVE.trim() : undefined;
const SHOPEE_AUTH_HOST_LIVE = process.env.SHOPEE_AUTH_HOST_LIVE ? process.env.SHOPEE_AUTH_HOST_LIVE.trim() : undefined;
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE ? process.env.SHOPEE_API_HOST_LIVE.trim() : undefined;
const SHOPEE_REDIRECT_URL_LIVE = process.env.SHOPEE_REDIRECT_URL_LIVE ? process.env.SHOPEE_REDIRECT_URL_LIVE.trim() : undefined;

// Validação melhorada para garantir que as variáveis de ambiente da Shopee estão definidas
console.log("--- Verificando Variáveis de Ambiente da Shopee ---");
console.log(`SHOPEE_PARTNER_ID_LIVE (Esperado: seu ID de parceiro): ${SHOPEE_PARTNER_ID_LIVE ? 'OK' : 'FALTANDO/INCORRETO'}`);
console.log(`SHOPEE_API_KEY_LIVE (Esperado: sua chave de API): OK`);
console.log(`SHOPEE_API_HOST_LIVE (Esperado: https://partner.shopeemobile.com ou .com.br): ${SHOPEE_API_HOST_LIVE ? 'OK' : 'FALTANDO/INCORRETO'}`);
console.log(`SHOPEE_REDIRECT_URL_LIVE (Esperado: Sua URL de callback): ${SHOPEE_REDIRECT_URL_LIVE ? 'OK' : 'FALTANDO/INCORRETO'}`);

let shopeeConfigOk = true;
if (!SHOPEE_PARTNER_ID_LIVE) {
    console.error("Erro: SHOPEE_PARTNER_ID_LIVE não está configurado.");
    shopeeConfigOk = false;
}
if (!SHOPEE_API_KEY_LIVE) {
    console.error("Erro: SHOPEE_API_KEY_LIVE não está configurado.");
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
} else {
    console.log("--- Todas as variáveis de ambiente da Shopee estão configuradas corretamente. ---");
}
console.log("------------------------------------------");

function generateShopeeAuthLink() {
    if (!SHOPEE_PARTNER_ID_LIVE || !SHOPEE_API_KEY_LIVE || !SHOPEE_REDIRECT_URL_LIVE || !SHOPEE_AUTH_HOST_LIVE) {
        console.error("Erro: Variáveis de ambiente SHOPEE_PARTNER_ID_LIVE, SHOPEE_API_KEY_LIVE, SHOPEE_REDIRECT_URL_LIVE ou SHOPEE_AUTH_HOST_LIVE não estão configuradas para gerar o link de autenticação.");
        console.error("Certifique-se de que o arquivo .env existe e as variáveis estão definidas.");
        process.exit(1);
    }

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
    return url;
}

async function getAccessTokenFromCode(code, shopId) {
    const path = "/api/v2/auth/token/get";
    const timestamp = Math.floor(Date.now() / 1000);
    const partnerId = Number(SHOPEE_PARTNER_ID_LIVE);

    const requestBody = {
        code: code,
        shop_id: Number(shopId),
        partner_id: partnerId
    };

    const baseString = `${partnerId}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');

    console.log(`[DEBUG_SIGN_GET_TOKEN] Partner ID: ${partnerId}`);
    console.log(`[DEBUG_SIGN_GET_TOKEN] Path: ${path}`);
    console.log(`[DEBUG_SIGN_GET_TOKEN] Timestamp: ${timestamp}`);
    console.log(`[DEBUG_SIGN_GET_TOKEN] Request Body (stringified): ${JSON.stringify(requestBody)}`);
    console.log(`[DEBUG_SIGN_GET_TOKEN] Base String COMPLETA: ${baseString}`);
    console.log(`[DEBUG_SIGN_GET_TOKEN] Generated Sign: ${sign}`);

    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

    try {
        console.log(`[DEBUG_API_CALL] URL para token: ${url}`);
        console.log(`[DEBUG_API_CALL] Request Body para token: ${JSON.stringify(requestBody)}`);
        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Host': new URL(SHOPEE_API_HOST_LIVE).host,
            }
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

async function refreshShopeeAccessToken(shopId, refreshToken) {
    const path = "/api/v2/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);
    const partnerId = Number(SHOPEE_PARTNER_ID_LIVE);

    const requestBody = {
        shop_id: Number(shopId),
        refresh_token: refreshToken,
        partner_id: partnerId
    };

    const baseString = `${partnerId}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseString).digest('hex');

    console.log(`[DEBUG_SIGN_REFRESH] Partner ID: ${partnerId}`);
    console.log(`[DEBUG_SIGN_REFRESH] Path: ${path}`);
    console.log(`[DEBUG_SIGN_REFRESH] Timestamp: ${timestamp}`);
    console.log(`[DEBUG_SIGN_REFRESH] Request Body (Refresh, stringified): ${JSON.stringify(requestBody)}`);
    console.log(`[DEBUG_SIGN_REFRESH] Base String COMPLETA (Refresh): ${baseString}`);
    console.log(`[DEBUG_SIGN_REFRESH] Generated Sign (Refresh): ${sign}`);

    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

    try {
        console.log(`[DEBUG_API_CALL_REFRESH] URL para refresh token: ${url}`);
        console.log(`[DEBUG_API_CALL_REFRESH] Request Body para refresh token: ${JSON.stringify(requestBody)}`);
        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Host': new URL(SHOPEE_API_HOST_LIVE).host,
            }
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

// Endpoint de Callback da Shopee - Onde a Shopee redireciona APÓS a autorização
router.get('/auth/shopee/callback', async (req, res) => {
    const { code, shop_id } = req.query;

    if (!code || !shop_id) {
        console.error('[API_ROUTE] Callback da Shopee sem code ou shop_id.');
        return res.status(400).send('Erro: Parâmetros de callback ausentes.');
    }

    console.log(`[API_ROUTE] Endpoint /auth/shopee/callback acionado com code e shop_id para Shop ID: ${shop_id}. CODE: ${code}`);

    const partnerId = Number(SHOPEE_PARTNER_ID_LIVE);
    const partnerKey = SHOPEE_API_KEY_LIVE;
    const redirectUrl = SHOPEE_REDIRECT_URL_LIVE;
    const apiHost = SHOPEE_API_HOST_LIVE;

    if (!partnerId || !partnerKey || !redirectUrl || !apiHost) {
        console.error("Erro: Variáveis de ambiente da Shopee não estão configuradas corretamente no contexto da rota de callback.");
        return res.status(500).send("Erro de configuração do servidor.");
    }

    // Usaremos um client_id fixo por enquanto. Em um sistema real, isso viria da sessão do usuário logado.
    const CLIENT_ID_FIXO = 1;
    const CONNECTION_NAME = 'shopee';

    try {
        const tokens = await getAccessTokenFromCode(code, shop_id);

        // === SALVAR OS TOKENS NO SUPABASE NA TABELA client_connections ===
        if (!shop_id || isNaN(Number(shop_id)) || !partnerId || isNaN(Number(partnerId))) {
            console.error('❌ [API_ROUTE] shop_id ou partner_id inválidos antes do upsert no Supabase.');
            return res.status(500).send('Erro: IDs inválidos para salvar tokens.');
        }

        const { data, error: upsertError } = await supabase
            .from('client_connections')
            .upsert(
                {
                    client_id: CLIENT_ID_FIXO,
                    connection_name: CONNECTION_NAME,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    access_token_expires_at: new Date(Date.now() + tokens.expire_in * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                    additional_data: {
                        shop_id: Number(shop_id),
                        partner_id: Number(partnerId)
                    }
                },
                { onConflict: ['client_id', 'connection_name'] }
            );

        if (upsertError) {
            const errorMessage = upsertError.message || 'Erro desconhecido no Supabase (objeto de erro vazio/nulo).';
            console.error('❌ [API_ROUTE] Erro ao salvar tokens no Supabase:', errorMessage);
            console.error('❌ [API_ROUTE] Detalhes completos do erro do Supabase:', upsertError);
            return res.status(500).json({ error: 'Erro ao salvar tokens no Supabase', details: errorMessage });
        } else {
            console.log(`✅ [API_ROUTE] Tokens salvos/atualizados no Supabase para Shop ID: ${shop_id} (client_id: ${CLIENT_ID_FIXO}, connection_name: ${CONNECTION_NAME}).`);
        }

        res.status(200).json({
            message: 'Access Token e Refresh Token obtidos e salvos no banco de dados com sucesso! Copie os valores abaixo para testes manuais.',
            shopId: shop_id,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expire_in
        });

    } catch (error) {
        console.error('Erro no fluxo de callback da Shopee:', error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).send(`Erro ao obter access token da Shopee: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
});


// Endpoint para buscar e salvar pedidos brutos da Shopee
router.get('/auth/shopee/fetch-orders', async (req, res) => {
    const { shopId } = req.query;

    if (!shopId) {
        return res.status(400).json({ error: 'shopId é obrigatório na query.' });
    }

    console.log(`[API_ROUTE] Endpoint /shopee/fetch-orders acionado para Shop ID: ${shopId}.`);

    const CLIENT_ID_FIXO = 1;
    const CONNECTION_NAME = 'shopee';

    try {
        const { data: connectionData, error: fetchError } = await supabase
            .from('client_connections')
            .select('access_token, refresh_token, access_token_expires_at, additional_data')
            .eq('client_id', CLIENT_ID_FIXO)
            .eq('connection_name', CONNECTION_NAME)
            .single();

        if (fetchError || !connectionData) {
            console.error('❌ [API_ROUTE] Erro ao buscar tokens no Supabase:', fetchError ? fetchError.message : 'Tokens não encontrados.');
            return res.status(404).json({ error: 'Tokens não encontrados para o shopId fornecido. Por favor, autorize a loja primeiro.' });
        }

        if (connectionData.additional_data && connectionData.additional_data.shop_id !== Number(shopId)) {
            console.warn(`[API_ROUTE] ShopId na query (${shopId}) não corresponde ao shop_id salvo em additional_data (${connectionData.additional_data.shop_id}) para esta conexão.`);
        }

        let accessToken = connectionData.access_token;
        let refreshToken = connectionData.refresh_token;
        const expiresAt = new Date(connectionData.access_token_expires_at);
        const now = new Date();
        const partnerId = connectionData.additional_data ? connectionData.additional_data.partner_id : Number(SHOPEE_PARTNER_ID_LIVE);

        if (now >= expiresAt) {
            console.log(`🔄 [API_ROUTE] Access Token para Shop ID: ${shopId} expirado. Tentando refrescar...`);
            try {
                const newTokens = await refreshShopeeAccessToken(shopId, refreshToken);
                accessToken = newTokens.access_token;
                refreshToken = newTokens.refresh_token;
                const newExpiresAt = new Date(Date.now() + newTokens.expire_in * 1000);

                const { error: updateError } = await supabase
                    .from('client_connections')
                    .upsert({
                        client_id: CLIENT_ID_FIXO,
                        connection_name: CONNECTION_NAME,
                        access_token: accessToken,
                        refresh_token: refreshToken,
                        access_token_expires_at: newExpiresAt.toISOString(),
                        updated_at: new Date().toISOString()
                    }, { onConflict: ['client_id', 'connection_name'] });

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

        // --- INÍCIO DO CÓDIGO ATUALIZADO PARA A CHAMADA DA API DE PEDIDOS ---
        const ordersPath = "/api/v2/order/get_order_list";
        const timestamp = Math.floor(Date.now() / 1000);

        // Cálculo de intervalo de tempo (últimos 7 dias)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const timeFrom = Math.floor(sevenDaysAgo.getTime() / 1000); // Unix timestamp em segundos
        const timeTo = timestamp; // Agora

        // Parâmetros que serão incluídos na assinatura, EM ORDEM ALFABÉTICA PELO NOME DO PARÂMETRO
        const signatureExtraParams = {
            cursor: "", // Adicionado para corresponder ao exemplo do manual Python
            order_status: 'READY_TO_SHIP', // Defina o status do pedido que deseja buscar
            page_size: 20, // Ajustado para 20 para corresponder ao exemplo do manual Python
            response_optional_fields: "order_status", // Adicionado para corresponder ao exemplo
            time_from: timeFrom, // Usando o cálculo de timeFrom de 7 dias atrás
            time_range_field: 'create_time', // Campo de tempo para o filtro
            time_to: timeTo, // Usando o cálculo de timeTo (agora)
        };

        // Constrói a string de parâmetros adicionais para a assinatura
        let sortedParamValuesForSignature = '';
        const sortedKeys = Object.keys(signatureExtraParams).sort(); // Garante ordem alfabética
        for (const key of sortedKeys) {
            sortedParamValuesForSignature += signatureExtraParams[key];
        }

        // Constrói a Base String COMPLETA para a assinatura (conforme documentação da Shopee para GET)
        const baseStringOrderList = `${partnerId}${ordersPath}${timestamp}${accessToken}${Number(shopId)}${sortedParamValuesForSignature}`;

        // Gera a assinatura HMAC-SHA256
        const signatureOrderList = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE)
                                       .update(baseStringOrderList)
                                       .digest('hex');

        // --- DEBUG LOGS: Mantenha estas linhas! Elas são essenciais para depuração ---
        console.log(`[DEBUG_SIGN_ORDER_LIST] sortedParamValuesForSignature: "${sortedParamValuesForSignature}"`);
        console.log(`[DEBUG_SIGN_ORDER_LIST] Base String COMPLETA (Order List): "${baseStringOrderList}"`);
        console.log(`[DEBUG_SIGN_ORDER_LIST] API Key being used (first 5 chars): "${SHOPEE_API_KEY_LIVE.substring(0, 5)}..."`);
        console.log(`[DEBUG_SIGN_ORDER_LIST] Access Token (first 5 chars): "${accessToken.substring(0, 5)}..."`);
        console.log(`[DEBUG_SIGN_ORDER_LIST] Shop ID used: ${Number(shopId)}`);
        console.log(`[DEBUG_SIGN_ORDER_LIST] Generated Sign (Order List): "${signatureOrderList}"`);

        // Constrói os parâmetros da query que iriam no final da URL, corrigindo a sintaxe.
        // ATENÇÃO: Os parâmetros DENTRO deste URLSearchParams serão ordenados ALFABETICAMENTE
        // pelo URLSearchParams. Mas eles virão DEPOIS dos parâmetros fixos na `ordersUrl`.
        const finalQueryParams = new URLSearchParams({
            timestamp: timestamp,
            shop_id: Number(shopId),
            // Corrigindo a sintaxe para pares chave-valor válidos
            order_status: 'READY_TO_SHIP', // Era '&order_status=READY_TO_SHIP,'
            partner_id: partnerId,
            access_token: accessToken,
            // Corrigindo a sintaxe para múltiplos pares chave-valor
            cursor: "",
            time_range_field: 'create_time',
            time_from: timeFrom, // Assumindo que 'timeFrom' é uma variável já definida
            time_to: timeTo,     // Assumindo que 'timeTo' é uma variável já definida
            sign: signatureOrderList,
            // Mantendo o spread de ...signatureExtraParams.
            // Certifique-se de que os campos acima (order_status, cursor, etc.)
            // não estejam duplicados dentro de signatureExtraParams, caso contrário,
            // URLSearchParams pode se comportar de forma inesperada com duplicatas.
            // O ideal é que eles venham apenas de um lugar.
            ...signatureExtraParams
        }).toString();

        // Constrói a URL final da API, montando-a na sequência EXATA que você deseja.
        // A parte fixa é adicionada primeiro, e depois o resultado de finalQueryParams.
        const ordersUrl = `${SHOPEE_API_HOST_LIVE}${ordersPath}?` +
                          `page_size=20` +
                          `&response_optional_fields=order_status` +
                          `&${finalQueryParams}`; // Adiciona o resultado do URLSearchParams aqui

        console.log(`[SHOPEE_API] Chamando: ${ordersUrl}`);

        // Faz a requisição HTTP real para a API da Shopee
        const shopeeResponse = await axios.get(ordersUrl, {
            headers: { 'Content-Type': 'application/json' }
        });
        // --- FIM DO CÓDIGO ATUALIZADO PARA A CHAMADA DA API DE PEDIDOS ---


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
                    platform_id: 1, // Assumindo 1 para Shopee. Você pode querer buscar isso de uma tabela de plataformas.
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