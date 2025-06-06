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
async function fetchAndSaveShopeeOrders(id, idType, orderStatus = 'READY_TO_SHIP', daysAgo = 7) {
    console.log(`[shopeeOrderService] Buscando e salvando pedidos para ${idType}: ${id}`);

    try {
        const { access_token } = await getValidatedShopeeTokens(id, idType);

        const timestamp = Math.floor(Date.now() / 1000);
        const timeFrom = Math.floor((Date.now() - daysAgo * 24 * 60 * 60 * 1000) / 1000);
        const timeTo = timestamp;

        const orderListQueryParams = {
            cursor: '""', // O cursor da Shopee é uma string vazia inicialmente
            order_status: orderStatus,
            page_size: 20,
            response_optional_fields: "order_status",
            time_from: timeFrom,
            time_range_field: 'create_time',
            time_to: timeTo,
        };

        // 1. Chamar a API para obter a lista de pedidos
        const shopeeResponseList = await getShopeeOrderList(id, idType, access_token, orderListQueryParams);

        if (shopeeResponseList.error) {
            throw new Error(shopeeResponseList.message || 'Erro desconhecido ao buscar lista de pedidos.');
        }

        const ordersSummary = shopeeResponseList.response.order_list;
        console.log(`[shopeeOrderService] ${ordersSummary.length} pedidos encontrados para ${idType}: ${id}.`);

        if (ordersSummary.length === 0) {
            console.log('[shopeeOrderService] Nenhum pedido novo para processar.');
            return [];
        }

        // 2. Extrair order_sn_list para buscar detalhes
        const orderSns = ordersSummary.map(order => order.order_sn);
        const detailQueryParams = {
            order_sn_list: orderSns,
            response_optional_fields: ["item_list", "recipient_address", "logistic_info", "payment_info", "actual_shipping_fee", "total_amount", "currency", "shipping_carrier", "payment_method", "buyer_username", "create_time", "update_time"]
        };

        // 3. Chamar a API para obter detalhes dos pedidos
        const shopeeResponseDetails = await getShopeeOrderDetail(id, idType, access_token, detailQueryParams);

        if (shopeeResponseDetails.error) {
            throw new Error(shopeeResponseDetails.message || 'Erro desconhecido ao buscar detalhes dos pedidos.');
        }

        const detailedOrders = shopeeResponseDetails.response.order_list;

        // 4. Inserir/Atualizar os pedidos brutos no Supabase
        const ordersToInsert = detailedOrders.map(order => ({
            order_sn: order.order_sn,
            shop_id: Number(order.shop_id || id), // Use order.shop_id se disponível, senão o id da requisição
            original_data: order, // Salva o objeto completo retornado pela API
            retrieved_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
            .from('orders_raw_shopee')
            .upsert(ordersToInsert, { onConflict: 'order_sn' });

        if (insertError) {
            console.error('❌ [shopeeOrderService] Erro ao salvar pedidos brutos no Supabase:', insertError.message);
            throw new Error(`Erro ao salvar pedidos brutos no Supabase: ${insertError.message}`);
        }

        return detailedOrders;

    } catch (error) {
        console.error('Erro em fetchAndSaveShopeeOrders:', error.message);
        throw error;
    }
}

/**
 * Normaliza pedidos brutos e os salva na tabela orders_detail_normalized.
 * @param {number} clientId ID do cliente para associar os pedidos normalizados.
 * @returns {Promise<number>} Número de pedidos normalizados.
 */
async function normalizeShopeeOrders(clientId = 1) {
    console.log(`[shopeeOrderService] Iniciando normalização para client_id: ${clientId}`);

    const { data: rawOrders, error: fetchRawError } = await supabase
        .from('orders_raw_shopee')
        .select('*');

    if (fetchRawError) {
        console.error('❌ [NORMALIZER] Erro ao buscar pedidos brutos:', fetchRawError.message);
        throw new Error(`Erro ao buscar pedidos brutos para normalização: ${fetchRawError.message}`);
    }

    if (!rawOrders || rawOrders.length === 0) {
        console.log('[NORMALIZER] Nenhuns pedidos brutos para normalizar.');
        return 0;
    }

    const normalizedOrders = [];

    for (const rawOrder of rawOrders) {
        const originalData = rawOrder.original_data;
        if (!originalData) continue;

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
            console.error(`❌ [NORMALIZER] Erro ao normalizar pedido SN: ${rawOrder.order_sn}. Erro: ${parseError.message}`);
        }
    }

    if (normalizedOrders.length > 0) {
        const { error: insertNormalizedError } = await supabase
            .from('orders_detail_normalized')
            .upsert(normalizedOrders, { onConflict: 'order_sn' });

        if (insertNormalizedError) {
            console.error('❌ [NORMALIZER] Erro ao salvar pedidos normalizados no Supabase:', insertNormalizedError.message);
            throw new Error(`Erro ao salvar pedidos normalizados: ${insertNormalizedError.message}`);
        }
    }
    return normalizedOrders.length;
}

module.exports = {
    fetchAndSaveShopeeOrders,
    normalizeShopeeOrders,
};