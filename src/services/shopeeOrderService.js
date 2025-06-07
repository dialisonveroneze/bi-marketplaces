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
        const connectionInfo = await authService.getValidatedShopeeTokens(id, idType);

        if (!connectionInfo || !connectionInfo.access_token) {
            throw new Error('Falha ao obter tokens de acesso ou access_token ausente.');
        }

        console.log(`[ShopeeOrderService] Etapa 1 Concluída: Tokens obtidos com sucesso. Access Token (primeiros 5): ${connectionInfo.access_token.substring(0, 5)}...`);

        // --- LÓGICA DE PAGINAÇÃO POR DATA: INÍCIO ---
        const allFetchedDetailedOrders = []; // Para acumular todos os pedidos de todas as janelas de 15 dias

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); // Primeiro dia do mês atual
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Último dia do mês atual

        let currentWindowStart = new Date(startOfMonth); // Começa no primeiro dia do mês

        while (currentWindowStart <= endOfMonth) {
            let currentWindowEnd = new Date(currentWindowStart);
            // Define o fim da janela de 15 dias, mas não mais que o fim do mês
            currentWindowEnd.setDate(currentWindowStart.getDate() + 14); // 15 dias de intervalo (inclusive o dia de início)

            if (currentWindowEnd > endOfMonth) {
                currentWindowEnd = new Date(endOfMonth); // Garante que não exceda o fim do mês
            }

            const timeFrom = Math.floor(currentWindowStart.getTime() / 1000);
            const timeTo = Math.floor(currentWindowEnd.getTime() / 1000);
			console.log(`\n--- [ShopeeOrderService] Processando janela de data: ${currentWindowStart.toISOString().split('T')[0]} a ${currentWindowEnd.toISOString().split('T')[0]} ---`);

			//... lógica interna para CHAMAR A API com timeFrom e timeTo ...

			currentWindowStart.setDate(currentWindowEnd.getDate() + 1); // Avança para a próxima janela
			
			console.log(`[ShopeeOrderService] Próxima janela de data começará em: ${currentWindowStart.toISOString().split('T')[0]}`);

            //console.log(`\n--- [ShopeeOrderService] Processando janela de data: ${currentWindowStart.toISOString().split('T')[0]} a ${currentWindowEnd.toISOString().split('T')[0]} ---`);

            let cursor = ""; // Cursor para paginação interna de cada janela de 15 dias
            let hasMore = true; // Flag para controlar a paginação dentro da janela

            while (hasMore) { // Loop para paginação dentro da janela de 15 dias
                const orderListQueryParams = {
                    cursor: cursor,
                    order_status: orderStatus,
                    page_size: 50, // Pode ajustar, mas 20 é um bom valor padrão.
                    response_optional_fields: "order_status",
                    time_from: timeFrom,
                    time_range_field: 'create_time',
                    time_to: timeTo,
                };
                console.log(`[ShopeeOrderService] Etapa 2: Parâmetros da lista de pedidos preparados: ${JSON.stringify(orderListQueryParams)}`);

                // 1. Chamar a API para obter a lista de pedidos
                console.log(`[ShopeeOrderService] Etapa 3: Chamando getShopeeOrderList...`);
                let shopeeResponseList;
                try {
                    shopeeResponseList = await shopeeAPI.getShopeeOrderList(connectionInfo, orderListQueryParams);
                } catch (apiError) {
                    // Captura erros de rede ou outros antes mesmo de ter uma resposta JSON
                    console.error(`❌ [ShopeeOrderService] Erro ao chamar getShopeeOrderList (rede/código): ${apiError.message}`);
                    hasMore = false; // Sai do loop interno e tenta próxima janela de data
                    break; // Sai do loop interno
                }

                // >>>>> CORREÇÃO: VERIFICAÇÃO DE ERRO DA API SHOPEE AQUI <<<<<
                // Garante que shopeeResponseList e shopeeResponseList.error existam
                if (shopeeResponseList && shopeeResponseList.error) {
                    console.error(`❌ [ShopeeOrderService] Erro retornado pela API de lista de pedidos: ${shopeeResponseList.message}`);
                    hasMore = false; // Não há mais dados nesta janela ou erro crítico
                    break; // Sai do loop interno
                }
                console.log(`[ShopeeOrderService] Etapa 3 Concluída: Resposta de getShopeeOrderList recebida.`);

                //const ordersSummary = shopeeResponseList.order_list ? shopeeResponseList.order_list : [];
				const ordersSummary = (shopeeResponseList && shopeeResponseList.order_list) ? shopeeResponseList.order_list : [];
                console.log(`[ShopeeOrderService] Etapa 4: ${ordersSummary.length} pedidos encontrados para ${idType}: ${id} nesta janela.`);

                if (ordersSummary.length === 0) {
                    console.log('[ShopeeOrderService] Etapa 4 Concluída: Nenhum pedido novo nesta janela ou cursor esgotado.');
                    hasMore = false; // Não há mais pedidos nesta janela de 15 dias
                    break; // Sai do loop interno
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
                let shopeeResponseDetails;
                try {
                    shopeeResponseDetails = await shopeeAPI.getShopeeOrderDetail(connectionInfo, detailQueryParams);
                } catch (apiError) {
                    // Captura erros de rede ou outros antes mesmo de ter uma resposta JSON
                    console.error(`❌ [ShopeeOrderService] Erro ao chamar getShopeeOrderDetail (rede/código): ${apiError.message}`);
                    // Se a busca de detalhes falha para um batch, podemos tentar continuar ou sair
                    hasMore = false; // Sai do loop interno para esta janela de data
                    break;
                }

                // >>>>> CORREÇÃO: VERIFICAÇÃO DE ERRO DA API SHOPEE AQUI <<<<<
                if (shopeeResponseDetails && shopeeResponseDetails.error) {
                    console.error(`❌ [ShopeeOrderService] Erro retornado pela API de detalhes de pedidos: ${shopeeResponseDetails.message}`);
                    hasMore = false; // Não há mais dados nesta janela ou erro crítico
                    break; // Sai do loop interno
                }
                console.log(`[ShopeeOrderService] Etapa 6 Concluída: Resposta de getShopeeOrderDetail recebida.`);

                const detailedOrders = shopeeResponseDetails.order_list ? shopeeResponseDetails.order_list : [];
                console.log(`[ShopeeOrderService] Etapa 7: ${detailedOrders.length} detalhes de pedidos obtidos.`);
                allFetchedDetailedOrders.push(...detailedOrders); // Acumula os pedidos detalhados

                // 4. Inserir/Atualizar os pedidos brutos no Supabase (inserir a cada batch é mais seguro para grandes volumes)
                console.log(`[ShopeeOrderService] Etapa 8: Preparando para inserir/atualizar ${detailedOrders.length} pedidos brutos no Supabase...`);
                const ordersToInsert = detailedOrders.map(order => ({
                    order_id: order.order_sn,
                    client_id: "1",//id, // Usando o 'id' passado para a função, que é o shop_id
                    received_at: new Date().toISOString(),
                    api_name: "shopee.v2.order.get_order_list", // Nome da API fixo para Shopee
                    raw_data: order,
                }));

                const { error: insertError } = await supabase
                    .from('orders_raw_shopee')
                    .upsert(ordersToInsert, { onConflict: 'order_id' });

                if (insertError) {
                    console.error('❌ [ShopeeOrderService] Etapa 8 Falhou: Erro ao salvar pedidos brutos no Supabase:', insertError.message);
                    // Decida se você quer lançar o erro e parar tudo ou apenas logar e continuar
                    // throw new Error(`Erro ao salvar pedidos brutos no Supabase: ${insertError.message}`);
                } else {
                    console.log(`[ShopeeOrderService] Etapa 8 Concluída: ${ordersToInsert.length} pedidos brutos salvos/atualizados no Supabase.`);
                }

                // >>>>> ATUALIZAR CURSOR E HASMORE PARA PAGINAÇÃO INTERNA <<<<<
                hasMore = shopeeResponseList.has_more;
                cursor = shopeeResponseList.next_cursor;
                console.log(`[ShopeeOrderService] Paginação interna: has_more: ${hasMore}, next_cursor: ${cursor}`);

                if (hasMore && cursor) {
                    console.log(`[ShopeeOrderService] Continuar buscando mais pedidos nesta janela de data com o cursor: ${cursor}`);
                    // Pequeno atraso para evitar sobrecarregar a API da Shopee
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } // Fim do while (hasMore) para paginação interna

            // Prepara para a próxima janela de 15 dias
			
			console.log(`[ShopeeOrderService] Próxima janela de data começará em: ${currentWindowStart.toISOString().split('T')[0]} (após ${currentWindowEnd.toISOString().split('T')[0]})`);
            console.log(`[ShopeeOrderService] Próxima janela de data começará em: ${currentWindowStart.toISOString().split('T')[0]}`);

			// CORREÇÃO AQUI 👇
			currentWindowStart = new Date(currentWindowEnd);
			currentWindowStart.setDate(currentWindowStart.getDate() + 1);
            currentWindowStart.setDate(currentWindowEnd.getDate() + 1); // Move para o dia seguinte ao fim da janela atual
			

        } // Fim do while (currentWindowStart <= endOfMonth) para paginação por data
        // --- LÓGICA DE PAGINAÇÃO POR DATA: FIM ---


        console.log(`[ShopeeOrderService] Finalizado o processamento de todas as janelas de data. Total de pedidos detalhados obtidos: ${allFetchedDetailedOrders.length}.`);
        return allFetchedDetailedOrders; // Retorna todos os pedidos acumulados
        //console.log(`[ShopeeOrderService] Finalizado o processamento de todas as janelas de data. Total de pedidos detalhados obtidos: ${allFetchedDetailedOrders.length}.`);
        //return allFetchedDetailedOrders; // Retorna todos os pedidos acumulados

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