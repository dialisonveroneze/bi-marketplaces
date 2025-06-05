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
    process.exit(1); // Adicionado process.exit(1) para parar a aplicação se as variáveis cruciais estiverem faltando
}

// Variáveis da Shopee
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE; 
const SHOPEE_AUTH_HOST_LIVE = process.env.SHOPEE_AUTH_HOST_LIVE; 
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE;
const SHOPEE_REDIRECT_URL_LIVE = process.env.SHOPEE_REDIRECT_URL_LIVE; 

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
    // Em um ambiente de produção, você pode querer lançar um erro ou encerrar o processo aqui
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
    const CLIENT_ID_FIXO = 1; // Ou outro ID que você queira associar
    const CONNECTION_NAME = 'shopee';

    try {
        const tokens = await getAccessTokenFromCode(code, shop_id);

        // === SALVAR OS TOKENS NO SUPABASE NA TABELA client_connections ===
        if (!shop_id || isNaN(Number(shop_id)) || !partnerId || isNaN(Number(partnerId))) {
            console.error('❌ [API_ROUTE] shop_id ou partner_id inválidos antes do upsert no Supabase.');
            return res.status(500).send('Erro: IDs inválidos para salvar tokens.');
        }

        const { data, error: upsertError } = await supabase
            .from('client_connections') // <<<<< CORRIGIDO AQUI: Tabela client_connections >>>>>
            .upsert(
                {
                    client_id: CLIENT_ID_FIXO, // <<<<< Adicionado client_id >>>>>
                    connection_name: CONNECTION_NAME, // <<<<< Adicionado connection_name >>>>>
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    access_token_expires_at: new Date(Date.now() + tokens.expire_in * 1000).toISOString(), // <<<<< Nome da coluna corrigido >>>>>
                    updated_at: new Date().toISOString(), // <<<<< Usando updated_at >>>>>
                    additional_data: { // <<<<< shop_id e partner_id movidos para additional_data >>>>>
                        shop_id: Number(shop_id),
                        partner_id: Number(partnerId)
                    }
                },
                { onConflict: ['client_id', 'connection_name'] } // <<<<< onConflict corrigido >>>>>
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

    // Usaremos o mesmo client_id fixo para buscar a conexão
    const CLIENT_ID_FIXO = 1; 
    const CONNECTION_NAME = 'shopee';

    try {
        // <<<<< CORRIGIDO AQUI: Buscando da tabela client_connections com client_id e connection_name >>>>>
        const { data: connectionData, error: fetchError } = await supabase
            .from('client_connections') 
            .select('access_token, refresh_token, access_token_expires_at, additional_data') // Adicionado additional_data para buscar shop_id/partner_id se necessário
            .eq('client_id', CLIENT_ID_FIXO)
            .eq('connection_name', CONNECTION_NAME)
            .single();

        if (fetchError || !connectionData) {
            console.error('❌ [API_ROUTE] Erro ao buscar tokens no Supabase:', fetchError ? fetchError.message : 'Tokens não encontrados.');
            return res.status(404).json({ error: 'Tokens não encontrados para o shopId fornecido. Por favor, autorize a loja primeiro.' });
        }
        
        // Verificação adicional para garantir que o shopId buscado corresponde ao da additional_data, se relevante
        if (connectionData.additional_data && connectionData.additional_data.shop_id !== Number(shopId)) {
             console.warn(`[API_ROUTE] ShopId na query (${shopId}) não corresponde ao shop_id salvo em additional_data (${connectionData.additional_data.shop_id}) para esta conexão.`);
             // Você pode decidir como lidar com isso: erro, ou continuar usando os tokens encontrados
        }

        let accessToken = connectionData.access_token;
        let refreshToken = connectionData.refresh_token;
        const expiresAt = new Date(connectionData.access_token_expires_at); // <<<<< Nome da coluna corrigido >>>>>
        const now = new Date();
        const partnerIdFromDB = connectionData.additional_data ? connectionData.additional_data.partner_id : Number(SHOPEE_PARTNER_ID_LIVE); // Pega partner_id do DB ou do env

        if (now >= expiresAt) {
            console.log(`🔄 [API_ROUTE] Access Token para Shop ID: ${shopId} expirado. Tentando refrescar...`);
            try {
                const newTokens = await refreshShopeeAccessToken(shopId, refreshToken); // shopId ainda é necessário para a API Shopee
                accessToken = newTokens.access_token;
                refreshToken = newTokens.refresh_token;
                const newExpiresAt = new Date(Date.now() + newTokens.expire_in * 1000);

                // <<<<< CORRIGIDO AQUI: Atualizando na tabela client_connections >>>>>
                const { error: updateError } = await supabase
                    .from('client_connections')
                    .upsert({
                        client_id: CLIENT_ID_FIXO,
                        connection_name: CONNECTION_NAME,
                        access_token: accessToken,
                        refresh_token: refreshToken,
                        access_token_expires_at: newExpiresAt.toISOString(), // <<<<< Nome da coluna corrigido >>>>>
                        updated_at: new Date().toISOString()
                    }, { onConflict: ['client_id', 'connection_name'] }); // <<<<< onConflict corrigido >>>>>

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
        const partnerId = partnerIdFromDB; // Usar o partnerId obtido do DB ou env

        // Assinatura para get_order_list (GET)
        const baseStringOrderList = `${partnerId}${ordersPath}${timestamp}${accessToken}${Number(shopId)}`;
        const signatureOrderList = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE).update(baseStringOrderList).digest('hex');

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

        // O upsert para 'orders_raw_shopee' permanece o mesmo, pois não depende da tabela 'client_connections'
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