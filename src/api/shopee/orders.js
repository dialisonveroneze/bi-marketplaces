// src/api/shopee/orders.js
const axios = require('axios');
const { supabase } = require('../../database');
const { generateShopeeSignature } = require('../../utils/security');

// Variáveis de ambiente - Certifique-se de que estão definidas no Render
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE;
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE;

/**
 * Busca detalhes de pedidos da Shopee para uma determinada loja e os salva no banco de dados.
 *
 * @param {string} shopId O ID da loja Shopee.
 * @param {string} accessToken O access token válido para a loja.
 * @param {number} connectionId O ID da conexão no Supabase para esta loja (usado como client_id).
 * @returns {Array} Uma lista dos pedidos processados.
 * @throws {Error} Se a requisição à Shopee falhar ou os pedidos não puderem ser salvos.
 */
async function fetchShopeeOrders(shopId, accessToken, connectionId) {
  console.log(`[DEBUG_SHOPEE] fetchShopeeOrders (Get Order Detail) chamada para Shop ID: ${shopId}`);
  console.log(`[DEBUG_SHOPEE] access_token recebido (parcial): ${accessToken ? accessToken.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);
  console.log(`[DEBUG_SHOPEE] connectionId recebido: ${connectionId}`);

  const path = '/api/v2/order/get_order_detail';
  const timestamp = Math.floor(Date.now() / 1000); // Timestamp atual em segundos

  // --- Importante: Em produção, você obteria esses order_sn_list de uma chamada prévia a get_order_list ---
  // Por ora, vamos usar os order_sn's de exemplo ou buscar os existentes na sua tabela orders_raw_shopee.
  let order_sn_list_to_fetch = [];
  try {
      // Tenta buscar os order_sn's já salvos na orders_raw_shopee para ter dados reais.
      // Ajuste o 'limit' conforme a necessidade e a capacidade da API Shopee (geralmente até 100).
      const { data: existingOrders, error: fetchError } = await supabase
          .from('orders_raw_shopee')
          .select('order_id')
          .limit(50); // Pegamos até 50 para o teste

      if (fetchError) {
          console.warn('⚠️ [DEBUG_SHOPEE] Não foi possível buscar order_sn_list existentes:', fetchError.message);
          // Se não conseguir, usa uma lista de amostra para não quebrar o processo
          order_sn_list_to_fetch = [
              "250604KPPCYPKG", // Exemplo de Order SNs que apareceram nos seus logs anteriores
              "250604KPPTA2C6",
              "250604KPUY8PVE",
              "250604KPW5E82Y",
              "250604KQQM9RW5"
          ];
      } else if (existingOrders.length > 0) {
          order_sn_list_to_fetch = existingOrders.map(order => order.order_id);
          console.log(`[DEBUG_SHOPEE] Usando ${order_sn_list_to_fetch.length} order_sn's existentes para get_order_detail.`);
      } else {
          // Se não houver pedidos existentes, usa a lista de amostra
          order_sn_list_to_fetch = [
              "250604KPPCYPKG",
              "250604KPPTA2C6",
              "250604KPUY8PVE",
              "250604KPW5E82Y",
              "250604KQQM9RW5"
          ];
          console.log(`[DEBUG_SHOPEE] Usando ${order_sn_list_to_fetch.length} order_sn's de amostra para get_order_detail (nenhum existente).`);
      }
  } catch (err) {
      console.error('❌ [DEBUG_SHOPEE] Erro ao tentar buscar order_sn_list existentes:', err.message);
      // Fallback para lista de amostra se houver um erro inesperado
      order_sn_list_to_fetch = [
          "250604KPPCYPKG",
          "250604KPPTA2C6",
          "250604KPUY8PVE",
          "250604KPW5E82Y",
          "250604KQQM9RW5"
      ];
  }

  if (order_sn_list_to_fetch.length === 0) {
      console.warn('[DEBUG_SHOPEE] Nenhuns order_sn para buscar detalhes. Encerrando.');
      return [];
  }

  const response_optional_fields = 'item_list,recipient_address,payment_info';

  const queryParams = {
    partner_id: Number(SHOPEE_PARTNER_ID_LIVE),
    shop_id: Number(shopId),
    timestamp: timestamp,
    order_sn_list: order_sn_list_to_fetch.join(','), // A API espera uma string separada por vírgulas
    response_optional_fields: response_optional_fields,
  };

  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID_LIVE,
    partner_key: SHOPEE_API_KEY_LIVE,
    timestamp: timestamp,
    access_token: accessToken,
    shop_id: shopId,
    order_sn_list: queryParams.order_sn_list,
    response_optional_fields: queryParams.response_optional_fields,
  });

  const orderedQueryParams = {
    access_token: accessToken,
    partner_id: queryParams.partner_id,
    order_sn_list: queryParams.order_sn_list,
    shop_id: queryParams.shop_id,
    timestamp: queryParams.timestamp,
    response_optional_fields: queryParams.response_optional_fields,
  };

  const queryString = Object.keys(orderedQueryParams)
    .sort()
    .map(key => `${key}=${orderedQueryParams[key]}`)
    .join('&');

  const ordersUrl = `${SHOPEE_API_HOST_LIVE}${path}?${queryString}&sign=${sign}`;

  console.log(`DEBUG: Final ordersUrl antes do axios.get (query completa e ordenada): ${ordersUrl}`);

  try {
    const response = await axios.get(ordersUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('--- DEBUG: Resposta RAW da Shopee para GetOrderDetail ---');
    console.log(JSON.stringify(response.data, null, 2));
    console.log(`--- DEBUG: Status HTTP da Resposta de Detalhes de Pedidos: ${response.status} ---`);
    console.log('----------------------------------------------------');

    if (response.data && response.data.response && Array.isArray(response.data.response.order_list)) {
      const shopeeOrdersDetails = response.data.response.order_list;
      console.log(`[DEBUG_SHOPEE] Encontrados ${shopeeOrdersDetails.length} detalhes de pedidos da Shopee.`);

      if (shopeeOrdersDetails.length > 0) {
        // --- 1. Salvar/Atualizar JSON Bruto em orders_raw_shopee ---
        const rawOrdersToUpsert = shopeeOrdersDetails.map(order => ({
          client_id: connectionId, // Usamos o connectionId passado como client_id
          order_id: order.order_sn,
          raw_data: order, // Salva o objeto de detalhe de pedido completo
          is_processed: false // NOVO: Marca como não processado para a normalização
        }));

        console.log(`[DEBUG_SHOPEE] Preparando ${rawOrdersToUpsert.length} pedidos RAW para upsert em orders_raw_shopee.`);
        const { error: rawInsertError } = await supabase
          .from('orders_raw_shopee')
          .upsert(rawOrdersToUpsert, { 
            onConflict: ['order_id'],
            ignoreDuplicates: false
          });

        if (rawInsertError) {
          console.error('❌ [fetchShopeeOrders] Erro ao salvar RAW data em orders_raw_shopee:', rawInsertError.message);
          // Não lançar erro aqui para permitir a normalização (se fosse chamado aqui)
        } else {
          console.log(`✅ [fetchShopeeOrders] ${rawOrdersToUpsert.length} pedidos RAW salvos/atualizados em orders_raw_shopee.`);
        }
      } else {
        console.log('[DEBUG_SHOPEE] Nenhuns detalhes de pedidos para salvar no Supabase.');
      }
      
      return shopeeOrdersDetails; // Retorna os detalhes obtidos da Shopee

    } else if (response.data.error || response.data.message) {
        const shopeeError = response.data.error || 'N/A';
        const shopeeMessage = response.data.message || 'N/A';
        throw new Error(`Erro da API Shopee (Detalhes de Pedidos): ${shopeeError} - ${shopeeMessage}. Resposta completa no log acima.`);
    } else {
        throw new Error('Formato de resposta de detalhes de pedidos inesperado da Shopee.');
    }

  } catch (error) {
    console.error('❌ [fetchShopeeOrders] Erro ao buscar/salvar detalhes de pedidos da Shopee:', error.message);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[DEBUG_SHOPEE_ORDERS] Detalhes do erro da API Shopee (Axios response):', JSON.stringify(error.response.data, null, 2));
      console.error(`[DEBUG_SHOPEE_ORDERS] Status HTTP: ${error.response.status}`);
      const shopeeErrorMessage = error.response.data.message || 'Erro desconhecido na resposta da Shopee.';
      throw new Error(`Request failed with status code ${error.response.status}: ${shopeeErrorMessage}`);
    } else {
      console.error('[DEBUG_SHOPEE_ORDERS] Erro geral:', error.message);
      throw error;
    }
  }
}

module.exports = {
  fetchShopeeOrders,
};