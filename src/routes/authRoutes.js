// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

console.log("entrou no authRoutes");

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
// Alterado o nome da variável para SHOPEE_APP_KEY_LIVE para clareza e padronização
const SHOPEE_APP_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE; // Certifique-se de que esta variável está configurada no Render/env com o nome exato que você usa (SHOPEE_API_KEY_LIVE ou SHOPEE_APP_KEY_LIVE)
const SHOPEE_AUTH_HOST_LIVE = process.env.SHOPEE_AUTH_HOST_LIVE;
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE;
const SHOPEE_REDIRECT_URL_LIVE = process.env.SHOPEE_REDIRECT_URL_LIVE;

// Validação melhorada para garantir que as variáveis de ambiente da Shopee estão definidas
console.log("--- Verificando Variáveis de Ambiente da Shopee ---");
console.log(`SHOPEE_PARTNER_ID_LIVE (Esperado: seu ID de parceiro): ${SHOPEE_PARTNER_ID_LIVE ? 'OK' : 'FALTANDO/INCORRETO'} ${SHOPEE_PARTNER_ID_LIVE}`);
console.log(`SHOPEE_APP_KEY_LIVE (Esperado: sua App Key): ${SHOPEE_APP_KEY_LIVE ? 'OK' : 'FALTANDO/INCORRETO'}${SHOPEE_APP_KEY_LIVE}`);
console.log(`SHOPEE_API_HOST_LIVE (Esperado: https://openplatform.shopee.com.br): ${SHOPEE_API_HOST_LIVE ? 'OK' : 'FALTANDO/INCORRETO'} ${SHOPEE_API_HOST_LIVE}`);
console.log(`SHOPEE_REDIRECT_URL_LIVE (Esperado: https://bi-marketplaces.onrender.com/auth/shopee/callback): ${SHOPEE_REDIRECT_URL_LIVE ? 'OK' : 'FALTANDO/INCORRETO'}${SHOPEE_REDIRECT_URL_LIVE}`); // Adicionado /auth/shopee/callback no log

let shopeeConfigOk = true;
if (!SHOPEE_PARTNER_ID_LIVE) {
    console.error("Erro: SHOPEE_PARTNER_ID_LIVE não está configurado.");
    shopeeConfigOk = false;
}
if (!SHOPEE_APP_KEY_LIVE) {
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
    // process.exit(1); // Descomente em produção se quiser parar a aplicação em caso de erro de configuração
} else {
    console.log("--- Todas as variáveis de ambiente da Shopee estão configuradas corretamente. ---");
}
console.log("------------------------------------------");

function generateShopeeAuthLink() {
    if (!SHOPEE_PARTNER_ID_LIVE || !SHOPEE_APP_KEY_LIVE || !SHOPEE_REDIRECT_URL_LIVE || !SHOPEE_AUTH_HOST_LIVE) {
        console.error("Erro: Variáveis de ambiente SHOPEE_PARTNER_ID_LIVE, SHOPEE_APP_KEY_LIVE, SHOPEE_REDIRECT_URL_LIVE ou SHOPEE_AUTH_HOST_LIVE não estão configuradas para gerar o link de autenticação.");
        console.error("Certifique-se de que o arquivo .env existe e as variáveis estão definidas.");
        process.exit(1); // Sair se não houver variáveis essenciais
    }

    const timest = Math.floor(Date.now() / 1000);
    const path = "/api/v2/shop/auth_partner";

    // ESTA É A BASE STRING CORRETA para auth_partner, CONFORME O MANUAL!
    // A base string para auth_partner é partner_id + path + timestamp
    // CORREÇÃO: Typo em SHOPEE_PARTENER_ID_LIVE para SHOPEE_PARTNER_ID_LIVE
    const tmpBaseString = `${SHOPEE_PARTNER_ID_LIVE}${path}${timest}`; 

    // A assinatura para auth_partner usa a APP KEY, não o PARTNER ID, na chave HMAC
    const sign = crypto.createHmac('sha256', SHOPEE_APP_KEY_LIVE) // ✅ Confirmado: Usar SHOPEE_APP_KEY_LIVE como chave aqui
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

// Comente ou remova as linhas abaixo, pois o server.js gerará o link
// console.log("--------------------------------------------------------------------------------");
// console.log("COPIE E COLE ESTE LINK NO SEU NAVEGADOR (use imediatamente):");
// console.log(generateShopeeAuthLink()); // Chamada da função para exibir o link
// console.log("--------------------------------------------------------------------------------");


/**
 * Obtém o access_token e refresh_token usando o code da Shopee.
 * @param {string} code O código de autorização obtido da Shopee.
 * @param {string} shopId O ID da loja.
 * @param {string} [mainAccountId] O ID da conta principal (opcional, para contas principais).
 * @returns {Promise<object>} Um objeto contendo access_token, refresh_token e expire_in.
 */
async function getAccessTokenFromCode(code, shopId, mainAccountId) {
    const path = "/api/v2/auth/token/get";
    const timestamp = Math.floor(Date.now() / 1000);
    const partnerId = Number(SHOPEE_PARTNER_ID_LIVE);

    // >>> ADICIONADO: DEBUG LOGS PARA PARTNER_ID <<<
    console.log(`[DEBUG_PARTNER_ID] Valor de SHOPEE_PARTNER_ID_LIVE: '${process.env.SHOPEE_PARTNER_ID_LIVE}'`);
    console.log(`[DEBUG_PARTNER_ID] Tipo de SHOPEE_PARTNER_ID_LIVE: ${typeof process.env.SHOPEE_PARTNER_ID_LIVE}`);
    console.log(`[DEBUG_PARTNER_ID] Valor de partnerId (depois de Number()): ${partnerId}`);
    console.log(`[DEBUG_PARTNER_ID] Tipo de partnerId (depois de Number()): ${typeof partnerId}`);
    // <<< FIM DOS DEBUG LOGS >>>

    let requestBody = {
        code: code,
        partner_id: partnerId
    };

    if (shopId) {
        requestBody.shop_id = Number(shopId);
    } else if (mainAccountId) {
        requestBody.main_account_id = Number(mainAccountId);
    }

    console.log(`[DEBUG_GET_TOKEN_PREP] Request Body (para API): ${JSON.stringify(requestBody)}`);


    // === CORREÇÃO AGORA CORRETA AQUI ===
    // A base string para token/get e access_token/get NÃO inclui JSON.stringify(requestBody)
    const baseString = `${partnerId}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', SHOPEE_APP_KEY_LIVE).update(baseString).digest('hex'); // Usando SHOPEE_APP_KEY_LIVE

    console.log(`[DEBUG_SIGN_GET_TOKEN] Partner ID: ${partnerId}`);
    console.log(`[DEBUG_SIGN_GET_TOKEN] Path: ${path}`);
    console.log(`[DEBUG_SIGN_GET_TOKEN] Timestamp: ${timestamp}`);
    console.log(`[DEBUG_SIGN_GET_TOKEN] Request Body (stringified para signature): ${JSON.stringify(requestBody)}`); // Apenas para log, não usado na baseString
    console.log(`[DEBUG_SIGN_GET_TOKEN] Base String COMPLETA (SEM Body para signature): ${baseString}`); // Log atualizado
    console.log(`[DEBUG_SIGN_GET_TOKEN] Generated Sign: ${sign}`);

    // === CORREÇÃO AGORA CORRETA AQUI ===
    // A URL para token NÃO inclui o redirect na query string, ele vai no payload POST
    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

    try {
        console.log(`[DEBUG_API_CALL] URL para token: ${url}`);
        console.log(`[DEBUG_API_CALL] Request Body para token: ${JSON.stringify(requestBody)}`);
        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.data.error) {
            throw new Error(response.data.message || 'Erro desconhecido ao obter access token.');
        }
        console.log('[SHOPEE_API] Resposta getAccessTokenFromCode:', response.data);
        return {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expire_in: response.data.expire_in,
            merchant_id_list: response.data.merchant_id_list, // Incluir se presente
            shop_id_list: response.data.shop_id_list // Incluir se presente
        };
    } catch (error) {
        console.error('Erro na requisição getAccessTokenFromCode:', error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Falha ao obter access token da Shopee: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}


/**
 * Atualiza o access_token usando o refresh_token.
 * @param {string} refreshToken O refresh token atual.
 * @param {string} [shopId] O ID da loja (se for uma conta de loja).
 * @param {string} [mainAccountId] O ID da conta principal (se for uma conta principal).
 * @returns {Promise<object>} Um objeto contendo access_token, refresh_token e expire_in.
 */
async function refreshShopeeAccessToken(refreshToken, shopId, mainAccountId) {
    const path = "/api/v2/auth/access_token/get"; // A mesma API GetAccessToken, mas com refresh_token
    const timestamp = Math.floor(Date.now() / 1000);
    const partnerId = Number(SHOPEE_PARTNER_ID_LIVE);

    // >>> ADICIONADO: DEBUG LOGS PARA PARTNER_ID <<<
    console.log(`[DEBUG_PARTNER_ID] Valor de SHOPEE_PARTNER_ID_LIVE: '${process.env.SHOPEE_PARTNER_ID_LIVE}'`);
    console.log(`[DEBUG_PARTNER_ID] Tipo de SHOPEE_PARTNER_ID_LIVE: ${typeof process.env.SHOPEE_PARTNER_ID_LIVE}`);
    console.log(`[DEBUG_PARTNER_ID] Valor de partnerId (depois de Number()): ${partnerId}`);
    console.log(`[DEBUG_PARTNER_ID] Tipo de partnerId (depois de Number()): ${typeof partnerId}`);
    // <<< FIM DOS DEBUG LOGS >>>

    let requestBody = {
        refresh_token: refreshToken,
        partner_id: partnerId
    };

    if (shopId) {
        requestBody.shop_id = Number(shopId);
    } else if (mainAccountId) {
        requestBody.main_account_id = Number(mainAccountId);
    }

    // === CORREÇÃO AGORA CORRETA AQUI ===
    // A base string para token/get e access_token/get NÃO inclui JSON.stringify(requestBody)
    const baseString = `${partnerId}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', SHOPEE_APP_KEY_LIVE).update(baseString).digest('hex'); // Usando SHOPEE_APP_KEY_LIVE

    console.log(`[DEBUG_SIGN_REFRESH] Partner ID: ${partnerId}`);
    console.log(`[DEBUG_SIGN_REFRESH] Path: ${path}`);
    console.log(`[DEBUG_SIGN_REFRESH] Timestamp: ${timestamp}`);
    console.log(`[DEBUG_SIGN_REFRESH] Request Body (Refresh, stringified para signature): ${JSON.stringify(requestBody)}`); // Apenas para log, não usado na baseString
    console.log(`[DEBUG_SIGN_REFRESH] Base String COMPLETA (Refresh, SEM Body para signature): ${baseString}`); // Log atualizado
    console.log(`[DEBUG_SIGN_REFRESH] Generated Sign (Refresh): ${sign}`);

    // === CORREÇÃO AGORA CORRETA AQUI ===
    const url = `${SHOPEE_API_HOST_LIVE}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

    try {
        console.log(`[DEBUG_API_CALL_REFRESH] URL para refresh token: ${url}`);
        console.log(`[DEBUG_API_CALL_REFRESH] Request Body para refresh token: ${JSON.stringify(requestBody)}`);
        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.data.error) {
            throw new Error(response.data.message || 'Erro desconhecido ao refrescar access token.');
        }
        console.log('[SHOPEE_API] Resposta refreshShopeeAccessToken:', response.data);
        return {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expire_in: response.data.expire_in,
            merchant_id_list: response.data.merchant_id_list, // Incluir se presente
            shop_id_list: response.data.shop_id_list // Incluir se presente
        };
    } catch (error) {
        console.error('Erro na requisição refreshShopeeAccessToken:', error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Falha ao refrescar access token da Shopee: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}


// --- Rotas da API ---

// Endpoint de Callback da Shopee - Onde a Shopee redireciona APÓS a autorização
router.get('/auth/shopee/callback', async (req, res) => {
    // Adicionado main_account_id para suportar contas principais também, conforme manual
    const { code, shop_id, main_account_id } = req.query; 
    console.log("Entrou na funcao router.get '/auth/shopee/callback' Endpoint de Callback da Shopee - Onde a Shopee redireciona APÓS a autorização ");

    if (!code || (!shop_id && !main_account_id)) { // Verifica se tem shop_id OU main_account_id
        console.error('[API_ROUTE] Callback da Shopee sem code ou shop_id/main_account_id.');
        return res.status(400).send('Erro: Parâmetros de callback ausentes (code, shop_id ou main_account_id).');
    }

    console.log(`[API_ROUTE] Endpoint /auth/shopee/callback acionado com code e ${shop_id ? 'shop_id' : 'main_account_id'}: ${shop_id || main_account_id}. CODE: ${code}`);

    const partnerId = Number(SHOPEE_PARTNER_ID_LIVE);
    const appKey = SHOPEE_APP_KEY_LIVE;
    const redirectUrl = SHOPEE_REDIRECT_URL_LIVE;
    const apiHost = SHOPEE_API_HOST_LIVE;

    if (!partnerId || !appKey || !redirectUrl || !apiHost) {
        console.error("Erro: Variáveis de ambiente da Shopee não estão configuradas corretamente no contexto da rota de callback.");
        return res.status(500).send("Erro de configuração do servidor. Por favor, verifique as variáveis de ambiente.");
    }

    try {
        const tokens = await getAccessTokenFromCode(code, shop_id, main_account_id); // Passa main_account_id

        // === SALVAR OS TOKENS NO SUPABASE ===
        // Determinar qual ID usar para o upsert (shop_id ou main_account_id)
        const idToSave = shop_id || main_account_id;
        const idType = shop_id ? 'shop_id' : 'main_account_id';

        if (!idToSave || isNaN(Number(idToSave)) || !partnerId || isNaN(Number(partnerId))) {
            console.error('❌ [API_ROUTE] ID de loja/conta principal ou partner_id inválidos antes do upsert no Supabase.');
            return res.status(500).send('Erro: IDs inválidos para salvar tokens.');
        }

        const { data, error: upsertError } = await supabase
            .from('api_connections_shopee') // Tabela para salvar dados de conexão
            .upsert(
                {
                    [idType]: Number(idToSave), // Usa a chave dinâmica para o ID
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: new Date(Date.now() + tokens.expire_in * 1000).toISOString(),
                    last_updated_at: new Date().toISOString(),
                    partner_id: Number(partnerId),
                    // Incluir listas de IDs se for uma conta principal
                    ...(tokens.merchant_id_list && { merchant_id_list: tokens.merchant_id_list }),
                    ...(tokens.shop_id_list && { shop_id_list: tokens.shop_id_list })
                },
                { onConflict: idType } // Conflito no shop_id ou main_account_id
            );

        if (upsertError) {
            // CORREÇÃO: Tratamento mais robusto para a mensagem de erro do Supabase
            const errorMessage = upsertError.message || 'Erro desconhecido no Supabase (objeto de erro vazio/nulo).';
            console.error('❌ [API_ROUTE] Erro ao salvar tokens no Supabase:', errorMessage);
            return res.status(500).json({ error: 'Erro ao salvar tokens no Supabase', details: errorMessage });
        } else {
            console.log(`✅ [API_ROUTE] Tokens salvos/atualizados no Supabase para ${idType}: ${idToSave}.`);
        }

        res.status(200).json({
            message: 'Access Token e Refresh Token obtidos e salvos no banco de dados com sucesso! Copie os valores abaixo para testes manuais.',
            [idType]: idToSave, // Retorna o ID apropriado
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expire_in,
            // Retorna listas de IDs se for uma conta principal
            ...(tokens.merchant_id_list && { merchantIdList: tokens.merchant_id_list }),
            ...(tokens.shop_id_list && { shopIdList: tokens.shop_id_list })
        });

    } catch (error) {
        console.error('Erro no fluxo de callback da Shopee:', error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).send(`Erro ao obter access token da Shopee: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
});


// Endpoint para buscar e salvar pedidos brutos da Shopee
router.get('/auth/shopee/fetch-orders', async (req, res) => {
    const { shopId, mainAccountId } = req.query; // Adicionado mainAccountId

    if (!shopId && !mainAccountId) {
        return res.status(400).json({ error: 'shopId ou mainAccountId é obrigatório na query.' });
    }

    const idToFetch = shopId || mainAccountId;
    const idType = shopId ? 'shop_id' : 'main_account_id';

    console.log(`[API_ROUTE] Endpoint /shopee/fetch-orders acionado para ${idType}: ${idToFetch}.`);

    try {
        const { data: connectionData, error: fetchError } = await supabase
            .from('api_connections_shopee')
            .select('access_token, refresh_token, token_expires_at')
            .eq(idType, idToFetch)
            .single();

        if (fetchError || !connectionData) {
            console.error('❌ [API_ROUTE] Erro ao buscar tokens no Supabase:', fetchError ? fetchError.message : 'Tokens não encontrados.');
            return res.status(404).json({ error: 'Tokens não encontrados para o ID fornecido. Por favor, autorize a loja/conta principal primeiro.' });
        }

        let accessToken = connectionData.access_token;
        let refreshToken = connectionData.refresh_token;
        const expiresAt = new Date(connectionData.token_expires_at);
        const now = new Date();

        if (now >= expiresAt) {
            console.log(`🔄 [API_ROUTE] Access Token para ${idType}: ${idToFetch} expirado. Tentando refrescar...`);
            try {
                const newTokens = await refreshShopeeAccessToken(refreshToken, shopId, mainAccountId); // Passa ambos os IDs
                accessToken = newTokens.access_token;
                refreshToken = newTokens.refresh_token;
                const newExpiresAt = new Date(Date.now() + newTokens.expire_in * 1000);

                const { error: updateError } = await supabase
                    .from('api_connections_shopee')
                    .upsert({
                        [idType]: Number(idToFetch),
                        access_token: accessToken,
                        refresh_token: refreshToken,
                        token_expires_at: newExpiresAt.toISOString()
                    }, { onConflict: idType });

                if (updateError) {
                    console.error('❌ [API_ROUTE] Erro ao atualizar tokens no Supabase após refresh:', updateError.message);
                } else {
                    console.log(`✅ [API_ROUTE] Tokens para ${idType}: ${idToFetch} refrescados e atualizados no Supabase.`);
                }

            } catch (refreshError) {
                console.error('❌ [API_ROUTE] Falha ao refrescar Access Token:', refreshError.message);
                return res.status(500).json({ error: 'Falha ao refrescar Access Token. Por favor, tente autorizar a loja novamente.', details: refreshError.message });
            }
        }

        const ordersPath = "/api/v2/order/get_order_list";
        const timestamp = Math.floor(Date.now() / 1000);
        const partnerId = Number(SHOPEE_PARTNER_ID_LIVE);

        // Assinatura para get_order_list (GET) - Esta já estava correta, inclui access_token e shop_id/main_account_id na base string
        let baseStringOrderList = `${partnerId}${ordersPath}${timestamp}${accessToken}`;
        if (shopId) {
            baseStringOrderList += `${Number(shopId)}`;
        } else if (mainAccountId) {
            baseStringOrderList += `${Number(mainAccountId)}`; // Verificar se get_order_list aceita main_account_id na assinatura
        }
        
        const signatureOrderList = crypto.createHmac('sha256', SHOPEE_APP_KEY_LIVE).update(baseStringOrderList).digest('hex');

        // Construindo a URL para a requisição GET
        let ordersUrl = `${SHOPEE_API_HOST_LIVE}${ordersPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${signatureOrderList}&access_token=${accessToken}`;
        if (shopId) {
            ordersUrl += `&shop_id=${shopId}`;
        } else if (mainAccountId) {
            ordersUrl += `&main_account_id=${mainAccountId}`;
        }
        ordersUrl += `&order_status=READY_TO_SHIP&page_size=10`;


        console.log(`[SHOPEE_API] Chamando: ${ordersUrl}`);

        const shopeeResponse = await axios.get(ordersUrl, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (shopeeResponse.data.error) {
            throw new Error(shopeeResponse.data.message || 'Erro desconhecido ao buscar pedidos.');
        }

        const orders = shopeeResponse.data.response.order_list;
        console.log(`[API_ROUTE] ${orders.length} pedidos encontrados para ${idType}: ${idToFetch}.`);

        if (orders.length > 0) {
            const ordersToInsert = orders.map(order => ({
                order_sn: order.order_sn,
                shop_id: Number(shopId), // Assumindo que shop_id estará presente mesmo para conta principal em order_list
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
                console.log(`✅ [API_ROUTE] ${orders.length} pedidos brutos salvos/atualizados em orders_raw_shopee para ${idType}: ${idToFetch}.`);
                res.status(200).json({ message: 'Pedidos brutos buscados e salvos com sucesso!', count: orders.length });
            }
        } else {
            console.log(`[API_ROUTE] Nenhuns pedidos encontrados para ${idType}: ${idToFetch}.`);
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
        const updateRawStatus = []; // Não está sendo usado, pode remover

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
                    platform_id: 1, // Assumindo 1 para Shopee
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

                // updateRawStatus.push(rawOrder.order_sn); // Esta linha não está sendo usada para nada, pode remover

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