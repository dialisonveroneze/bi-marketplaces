// src/services/shopeeOrderService.js
const axios = require('axios');
const crypto = require('crypto');
const shopeeConfig = require('../config/shopeeConfig');
const supabase = require('../config/supabase');
const { getValidatedShopeeTokens } = require('./shopeeAuthService'); // Importa a função de validação de tokens

const { SHOPEE_PARTNER_ID_LIVE, SHOPEE_API_KEY_LIVE, SHOPEE_API_HOST_LIVE } = shopeeConfig;

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

    const { access_token, partner_id } = await getValidatedShopeeTokens(id, idType);

    const ordersPath = "/api/v2/order/get_order_list";
    const timestamp = Math.floor(Date.now() / 1000);
    const timeFrom = Math.floor((Date.now() - daysAgo * 24 * 60 * 60 * 1000) / 1000);
    const timeTo = timestamp;

    const signatureQueryParams = {
        cursor: '""',
        order_status: orderStatus,
        page_size: 20,
        response_optional_fields: "order_status",
        time_from: timeFrom,
        time_range_field: 'create_time',
        time_to: timeTo,
    };

    let sortedParamValuesForSignature = '';
    const sortedKeys = Object.keys(signatureQueryParams).sort();
    for (const key of sortedKeys) {
        sortedParamValuesForSignature += signatureQueryParams[key];
    }

    let baseStringOrderList = `${partner_id}${ordersPath}${timestamp}${access_token}`;
    baseStringOrderList += (idType === 'shop_id') ? `${Number(id)}` : `${Number(id)}`; // Adiciona shop_id ou main_account_id
    baseStringOrderList += `${sortedParamValuesForSignature}`;

    const signatureOrderList = crypto.createHmac('sha256', SHOPEE_API_KEY_LIVE)
                                     .update(baseStringOrderList)
                                     .digest('hex');

    let ordersUrl = `${SHOPEE_API_HOST_LIVE}${ordersPath}?` +
                        `access_token=${access_token}` +
                        `&partner_id=${partner_id}` +
                        `&sign=${signatureOrderList}` +
                        `&timestamp=${timestamp}`;

    ordersUrl += (idType === 'shop_id') ? `&shop_id=${Number(id)}` : `&main_account_id=${Number(id)}`;

    ordersUrl += `&cursor=${encodeURIComponent('""')}` +
                 `&order_status=${orderStatus}` +
                 `&page_size=20` +
                 `&response_optional_fields=order_status` +
                 `&time_from=${timeFrom}` +
                 `&time_range_field=create_time` +
                 `&time_to=${timeTo}`;

    try {
        const shopeeResponse = await axios.get(ordersUrl, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (shopeeResponse.data.error) throw new Error(shopeeResponse.data.message || 'Erro desconhecido ao buscar pedidos.');

        const orders = shopeeResponse.data.response.order_list;
        console.log(`[shopeeOrderService] ${orders.length} pedidos encontrados para ${idType}: ${id}.`);

        if (orders.length > 0) {
            const ordersToInsert = orders.map(order => ({
                order_sn: order.order_sn,
                shop_id: Number(order.shop_id),
                original_data: order,
                retrieved_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabase
                .from('orders_raw_shopee')
                .upsert(ordersToInsert, { onConflict: 'order_sn' });

            if (insertError) {
                console.error('❌ [shopeeOrderService] Erro ao salvar pedidos brutos no Supabase:', insertError.message);
                throw new Error(`Erro ao salvar pedidos brutos no Supabase: ${insertError.message}`);
            }
        }
        return orders;
    } catch (error) {
        console.error('Erro em fetchAndSaveShopeeOrders:', error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Falha ao buscar pedidos da Shopee: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
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