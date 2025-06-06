// src/services/shopeeOrderService.js
const supabase = require('../config/supabase'); // Certifique-se de que este caminho está correto
const { getValidatedShopeeTokens } = require('./shopeeAuthService'); // Sua função de validação de tokens
const { getShopeeOrderList, getShopeeOrderDetail } = require('./shopeeOrderAPI'); // <-- NOVA IMPORTAÇÃO

/**
 * Busca pedidos da Shopee e os salva na tabela orders_raw_shopee.
 * @param {string} id O ID da loja ou conta principal.
 * @param {string} idType 'shop_id' ou 'main_account_id'.
 * @param {string} orderStatus O status do pedido a ser buscado (ex: 'READY_TO_SHIP').
 * @param {number} daysAgo Quantidade de dias para buscar pedidos (ex: 7 para 7 dias atrás).
 * @returns {Promise<Array>} Lista de pedidos brutos obtidos.
 */
// src/services/shopeeOrderService.js
const shopeeAPI = require('./shopeeOrderAPI');
const authService = require('./shopeeAuthService'); // Precisamos importar authService

// Importar as funções específicas para a API da Shopee
const { getShopeeOrderList, getShopeeOrderDetail } = shopeeAPI;
const { getValidatedShopeeTokens } = authService; // Importar a função de autenticação

async function fetchAndSaveShopeeOrders(id, idType, orderStatus = 'READY_TO_SHIP', daysAgo = 7) {
    console.log(`\n--- [ShopeeOrderService] Iniciando fetchAndSaveShopeeOrders para ${idType}: ${id} ---`);
    console.log(`[ShopeeOrderService] Buscando e salvando pedidos para ${idType}: ${id}`);

    try {
        console.log(`[ShopeeOrderService] Etapa 1: Tentando obter tokens validados para ${idType}: ${id}...`);

        // Aqui obtemos o objeto connectionInfo completo, que contém access_token, shop_id, partner_id, etc.
        const connectionInfo = await getValidatedShopeeTokens(id, idType);
        
        // Verificação defensiva para garantir que o access_token exista antes de tentar usar substring
        if (!connectionInfo || !connectionInfo.access_token) {
            throw new Error('Falha ao obter tokens de acesso ou access_token ausente.');
        }

        console.log(`[ShopeeOrderService] Etapa 1 Concluída: Tokens obtidos com sucesso. Access Token (primeiros 5): ${connectionInfo.access_token.substring(0, 5)}...`);

        const timeFrom = Math.floor((Date.now() - daysAgo * 24 * 60 * 60 * 1000) / 1000);
        const timeTo = Math.floor(Date.now() / 1000); // Use o timestamp atual para timeTo

        const orderListQueryParams = {
            cursor: '""', // O cursor da Shopee é uma string vazia inicialmente
            order_status: orderStatus,
            page_size: 20,
            response_optional_fields: "order_status",
            time_from: timeFrom,
            time_range_field: 'create_time',
            time_to: timeTo,
        };
        console.log(`[ShopeeOrderService] Etapa 2: Parâmetros da lista de pedidos preparados: ${JSON.stringify(orderListQueryParams)}`);

        // 1. Chamar a API para obter a lista de pedidos
        console.log(`[ShopeeOrderService] Etapa 3: Chamando getShopeeOrderList...`);
        // PASSAR o objeto connectionInfo completo como o primeiro argumento
        const shopeeResponseList = await getShopeeOrderList(connectionInfo, orderListQueryParams);
        console.log(`[ShopeeOrderService] Etapa 3 Concluída: Resposta de getShopeeOrderList recebida.`);

        // A função getShopeeOrderList no shopeeOrderAPI.js já retorna response.data.response,
        // então não precisamos do shopeeResponseList.response aqui.
        // O `error` também viria no nível superior se houvesse um erro HTTP antes do parsing do JSON.
        // Se `error` vier dentro do corpo da resposta, precisamos verificar.
        if (shopeeResponseList.error) {
            console.error(`❌ [ShopeeOrderService] Erro retornado pela API de lista de pedidos: ${shopeeResponseList.message}`);
            throw new Error(shopeeResponseList.message || 'Erro desconhecido ao buscar lista de pedidos.');
        }
        
        const ordersSummary = shopeeResponseList.order_list ? shopeeResponseList.order_list : [];
        console.log(`[ShopeeOrderService] Etapa 4: ${ordersSummary.length} pedidos encontrados para ${idType}: ${id}.`);

        if (ordersSummary.length === 0) {
            console.log('[ShopeeOrderService] Etapa 4 Concluída: Nenhum pedido novo para processar.');
            return [];
        }

        // 2. Extrair order_sn_list para buscar detalhes
        const orderSns = ordersSummary.map(order => order.order_sn);
        const detailQueryParams = {
            order_sn_list: orderSns,
            response_optional_fields: ["item_list", "recipient_address", "logistic_info", "payment_info", "actual_shipping_fee", "total_amount", "currency", "shipping_carrier", "payment_method", "buyer_username", "create_time", "update_time"]
        };
        console.log(`[ShopeeOrderService] Etapa 5: IDs de pedidos e parâmetros de detalhes preparados. Total de IDs: ${orderSns.length}`);

        // 3. Chamar a API para obter detalhes dos pedidos
        console.log(`[ShopeeOrderService] Etapa 6: Chamando getShopeeOrderDetail...`);
        // PASSAR o objeto connectionInfo completo como o primeiro argumento
        const shopeeResponseDetails = await getShopeeOrderDetail(connectionInfo, detailQueryParams);
        console.log(`[ShopeeOrderService] Etapa 6 Concluída: Resposta de getShopeeOrderDetail recebida.`);

        if (shopeeResponseDetails.error) {
            console.error(`❌ [ShopeeOrderService] Erro retornado pela API de detalhes de pedidos: ${shopeeResponseDetails.message}`);
            throw new Error(shopeeResponseDetails.message || 'Erro desconhecido ao buscar detalhes dos pedidos.');
        }

        const detailedOrders = shopeeResponseDetails.order_list ? shopeeResponseDetails.order_list : [];
        console.log(`[ShopeeOrderService] Etapa 7: ${detailedOrders.length} detalhes de pedidos obtidos.`);

        // 4. Inserir/Atualizar os pedidos brutos no Supabase
        console.log(`[ShopeeOrderService] Etapa 8: Preparando para inserir/atualizar pedidos brutos no Supabase...`);
        const ordersToInsert = detailedOrders.map(order => ({
            order_sn: order.order_sn,
            shop_id: Number(connectionInfo.shop_id || id), // Use connectionInfo.shop_id
            original_data: order, // Salva o objeto completo retornado pela API
            retrieved_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
            .from('orders_raw_shopee')
            .upsert(ordersToInsert, { onConflict: 'order_sn' });

        if (insertError) {
            console.error('❌ [ShopeeOrderService] Etapa 8 Falhou: Erro ao salvar pedidos brutos no Supabase:', insertError.message);
            throw new Error(`Erro ao salvar pedidos brutos no Supabase: ${insertError.message}`);
        }
        console.log(`[ShopeeOrderService] Etapa 8 Concluída: ${ordersToInsert.length} pedidos brutos salvos/atualizados no Supabase.`);

        return detailedOrders;

    } catch (error) {
        console.error('❌ Erro final em fetchAndSaveShopeeOrders:', error.message);
        throw error;
    } finally {
        console.log(`--- [ShopeeOrderService] Finalizando fetchAndSaveShopeeOrders para ${idType}: ${id} ---\n`);
    }
}

// Para usar essa função em outros arquivos (e na rota de teste)
module.exports = {
    fetchAndSaveShopeeOrders
};

/**
 * Normaliza pedidos brutos e os salva na tabela orders_detail_normalized.
 * @param {number} clientId ID do cliente para associar os pedidos normalizados.
 * @returns {Promise<number>} Número de pedidos normalizados.
 */
async function normalizeShopeeOrders(clientId = 1) {
    console.log(`\n--- [ShopeeOrderService] Iniciando normalização para client_id: ${clientId} ---`); // Aprimorado

    console.log(`[ShopeeOrderService] Normalização: Buscando pedidos brutos no Supabase...`); // Aprimorado
    const { data: rawOrders, error: fetchRawError } = await supabase
        .from('orders_raw_shopee')
        .select('*');

    if (fetchRawError) {
        console.error('❌ [ShopeeOrderService] Normalização: Erro ao buscar pedidos brutos:', fetchRawError.message); // Aprimorado
        throw new Error(`Erro ao buscar pedidos brutos para normalização: ${fetchRawError.message}`);
    }

    if (!rawOrders || rawOrders.length === 0) {
        console.log('[ShopeeOrderService] Normalização: Nenhuns pedidos brutos para normalizar.'); // Aprimorado
        return 0;
    }
    console.log(`[ShopeeOrderService] Normalização: ${rawOrders.length} pedidos brutos encontrados para normalizar.`); // Aprimorado

    const normalizedOrders = [];

    for (const rawOrder of rawOrders) {
        const originalData = rawOrder.original_data;
        if (!originalData) {
            console.warn(`[ShopeeOrderService] Normalização: Pulando pedido sem 'original_data': ${rawOrder.order_sn}`); // Aprimorado
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
        } catch (parseError) {
            console.error(`❌ [ShopeeOrderService] Normalização: Erro ao normalizar pedido SN: ${rawOrder.order_sn}. Erro: ${parseError.message}`); // Aprimorado
        }
    }
    console.log(`[ShopeeOrderService] Normalização: ${normalizedOrders.length} pedidos normalizados processados.`); // Aprimorado

    if (normalizedOrders.length > 0) {
        console.log(`[ShopeeOrderService] Normalização: Salvando pedidos normalizados no Supabase...`); // Aprimorado
        const { error: insertNormalizedError } = await supabase
            .from('orders_detail_normalized')
            .upsert(normalizedOrders, { onConflict: 'order_sn' });

        if (insertNormalizedError) {
            console.error('❌ [ShopeeOrderService] Normalização: Erro ao salvar pedidos normalizados no Supabase:', insertNormalizedError.message); // Aprimorado
            throw new Error(`Erro ao salvar pedidos normalizados: ${insertNormalizedError.message}`);
        }
        console.log(`✅ [ShopeeOrderService] Normalização: ${normalizedOrders.length} pedidos normalizados salvos/atualizados no Supabase.`); // Aprimorado
    }
    console.log(`--- [ShopeeOrderService] Normalização concluída para client_id: ${clientId} ---\n`); // Aprimorado
    return normalizedOrders.length;
}

module.exports = {
    fetchAndSaveShopeeOrders,
    normalizeShopeeOrders,
};