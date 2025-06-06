// src/services/shopeeOrderService.js
const shopeeAPI = require('./shopeeOrderAPI'); // Importa o módulo completo
const authService = require('./shopeeAuthService'); // Importa o módulo completo
const supabase = require('../config/supabase');

// Removidas as desestruturações aqui para evitar declarações duplicadas.
// As funções serão acessadas via 'shopeeAPI.getShopeeOrderList', etc.

async function fetchAndSaveShopeeOrders(id, idType, orderStatus = 'READY_TO_SHIP', daysAgo = 7) {
    console.log(`\n--- [ShopeeOrderService] Iniciando fetchAndSaveShopeeOrders para ${idType}: ${id} ---`);
    console.log(`[ShopeeOrderService] Buscando e salvando pedidos para ${idType}: ${id}`);

    try {
        console.log(`[ShopeeOrderService] Etapa 1: Tentando obter tokens validados para ${idType}: ${id}...`);

        // Acessa getValidatedShopeeTokens via authService
        const connectionInfo = await authService.getValidatedShopeeTokens(id, idType);
        
        if (!connectionInfo || !connectionInfo.access_token) {
            throw new Error('Falha ao obter tokens de acesso ou access_token ausente.');
        }

        console.log(`[ShopeeOrderService] Etapa 1 Concluída: Tokens obtidos com sucesso. Access Token (primeiros 5): ${connectionInfo.access_token.substring(0, 5)}...`);

		// 1. Calcular o início e o fim do mês atual
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); // Primeiro dia do mês atual
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Último dia do mês atual

		// Convertendo para timestamp Unix (segundos)
		const timeFrom = Math.floor(startOfMonth.getTime() / 1000);
		const timeTo = Math.floor(endOfMonth.getTime() / 1000);

       // const timeFrom = Math.floor((Date.now() - daysAgo * 24 * 60 * 60 * 1000) / 1000);
       // const timeTo = Math.floor(Date.now() / 1000);

        const orderListQueryParams = {
            cursor: "", // <-- AQUI! Agora é uma string vazia real.
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
        // Acessa getShopeeOrderList via shopeeAPI
        const shopeeResponseList = await shopeeAPI.getShopeeOrderList(connectionInfo, orderListQueryParams);
        console.log(`[ShopeeOrderService] Etapa 3 Concluída: Resposta de getShopeeOrderList recebida.`);

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
        // Acessa getShopeeOrderDetail via shopeeAPI
        const shopeeResponseDetails = await shopeeAPI.getShopeeOrderDetail(connectionInfo, detailQueryParams);
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
			order_id: order.order_sn, // <-- Correto: usa ':'
			client_id: "1",           // <-- CORREÇÃO AQUI: de '=' para ':'
			// Se você quiser usar o shop_id da conexão, descomente e ajuste:
			// shop_id: Number(connectionInfo.shop_id || id),
			// order_id: order, // Esta linha está comentada e parece duplicada com a primeira order_id: order.order_sn
			received_at: new Date().toISOString(),
			api_name: order.platform_name || "Valor Padrão", // Se existisse, pegaria de 'order.platform_name'             
			raw_data: order, // <--- ADICIONE ESTA LINHA!
        }));

        const { error: insertError } = await supabase
            .from('orders_raw_shopee')
            .upsert(ordersToInsert, { onConflict: 'order_id' });

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

module.exports = {
    fetchAndSaveShopeeOrders
};