// src/api/shopee/orders.js
const axios = require('axios');
const { supabase } = require('../../database');
const { generateShopeeSignature } = require('../../utils/security');

// Variáveis de ambiente - Certifique-se de que estão definidas
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE;
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE;

/**
 * Busca pedidos da Shopee para uma determinada loja e os salva no banco de dados.
 *
 * @param {number} shopId O ID da loja Shopee.
 * @param {string} accessToken O access token válido para a loja.
 * @param {string} connectionId O ID da conexão no Supabase para esta loja.
 * @returns {Array} Uma lista dos pedidos processados.
 * @throws {Error} Se a requisição à Shopee falhar ou os pedidos não puderem ser salvos.
 */
async function fetchShopeeOrders(shopId, accessToken, connectionId) {
  console.log(`[DEBUG_SHOPEE] fetchShopeeOrders chamada para Shop ID: ${shopId}`);
  console.log(`[DEBUG_SHOPEE] access_token recebido (parcial): ${accessToken ? accessToken.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);

  const path = '/api/v2/order/get_order_list';
  const timestamp = Math.floor(Date.now() / 1000); // Timestamp atual em segundos

  // Calcula o timestamp para 7 dias atrás
  const sevenDaysAgo = Math.floor((Date.now() - (7 * 24 * 60 * 60 * 1000)) / 1000);

  // Parâmetros de query para a requisição de pedidos
  const queryParams = {
    partner_id: Number(SHOPEE_PARTNER_ID_LIVE),
    shop_id: Number(shopId),
    timestamp: timestamp,
    time_from: sevenDaysAgo,
    time_to: timestamp,
    time_range_field: 'create_time', // Campo pelo qual a Shopee deve filtrar (create_time ou update_time)
    page_size: 100, // Número de pedidos por página (máximo 100)
    // --- MUDANÇA AQUI: REMOVENDO 'recipient_address' de response_optional_fields ---
    // Deixando apenas 'order_status' e 'items'. Se 'items' der erro, removemos também.
    response_optional_fields: 'order_status,items',
    // cursor: '', // Para paginação de resultados (se houver mais de 100 pedidos)
  };

  // Log dos parâmetros que serão usados na assinatura
  console.log('[DEBUG_SHOPEE] Gerando assinatura com os seguintes parâmetros:');
  console.log(`  - path: ${path}`);
  console.log(`  - partner_id: ${queryParams.partner_id}`);
  console.log(`  - timestamp: ${queryParams.timestamp}`);
  console.log(`  - shop_id: ${queryParams.shop_id}`);
  console.log(`  - access_token (parcial para assinatura): ${accessToken ? accessToken.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);
  console.log(`  - time_from: ${queryParams.time_from}`);
  console.log(`  - time_to: ${queryParams.time_to}`);
  console.log(`  - time_range_field: ${queryParams.time_range_field}`);
  console.log(`  - page_size: ${queryParams.page_size}`);
  if (queryParams.response_optional_fields) {
      console.log(`  - response_optional_fields: ${queryParams.response_optional_fields}`);
  }

  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID_LIVE,
    partner_key: SHOPEE_API_KEY_LIVE,
    timestamp: timestamp,
    access_token: accessToken,
    shop_id: shopId,
    time_from: queryParams.time_from,
    time_to: queryParams.time_to,
    time_range_field: queryParams.time_range_field,
    page_size: queryParams.page_size,
    response_optional_fields: queryParams.response_optional_fields, // Incluído na assinatura
  });

  const orderedQueryParams = {
    access_token: accessToken,
    partner_id: queryParams.partner_id,
    page_size: queryParams.page_size,
    shop_id: queryParams.shop_id,
    time_from: queryParams.time_from,
    time_range_field: queryParams.time_range_field,
    time_to: queryParams.time_to,
    timestamp: queryParams.timestamp,
  };
  if (queryParams.response_optional_fields) {
      orderedQueryParams.response_optional_fields = queryParams.response_optional_fields;
  }

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

    console.log('--- DEBUG: Resposta RAW da Shopee para GetOrdersList ---');
    console.log(JSON.stringify(response.data, null, 2));
    console.log(`--- DEBUG: Status HTTP da Resposta de Pedidos: ${response.status} ---`);
    console.log('----------------------------------------------------');

    if (response.data && response.data.response && Array.isArray(response.data.response.order_list)) {
      const orders = response.data.response.order_list;
      console.log(`[DEBUG_SHOPEE] Encontrados ${orders.length} pedidos.`);

      if (orders.length > 0) {
        const ordersToUpsert = orders.map(order => ({
          client_id: connectionId,
          order_id: order.order_sn,
          raw_data: order, // Salva o objeto de pedido completo (com os campos opcionais agora corretos)
          order_status: order.order_status || null,
          created_at: order.create_time ? new Date(order.create_time * 1000).toISOString() : null,
          updated_at: order.update_time ? new Date(order.update_time * 1000).toISOString() : null,
        }));

        console.log(`[DEBUG_SHOPEE] Preparando ${ordersToUpsert.length} pedidos para upsert no Supabase.`);
        
        const { error: insertError } = await supabase
          .from('orders_raw_shopee')
          .upsert(ordersToUpsert, { 
            onConflict: ['order_id'],
            ignoreDuplicates: false
          });

        if (insertError) {
          console.error('❌ [fetchShopeeOrders] Erro ao salvar pedidos no Supabase:', insertError.message);
          throw insertError;
        }
        console.log(`✅ [fetchShopeeOrders] ${orders.length} pedidos salvos/atualizados no Supabase.`);
      } else {
        console.log('[DEBUG_SHOPEE] Nenhuns pedidos para salvar no Supabase.');
      }
      
      return orders;

    } else if (response.data.error || response.data.message) {
        const shopeeError = response.data.error || 'N/A';
        const shopeeMessage = response.data.message || 'N/A';
        throw new Error(`Erro da API Shopee (Pedidos): ${shopeeError} - ${shopeeMessage}. Resposta completa no log acima.`);
    } else {
        throw new Error('Formato de resposta de pedidos inesperado da Shopee.');
    }

  } catch (error) {
    console.error('❌ [fetchShopeeOrders] Erro ao buscar/salvar pedidos da Shopee:', error.message);
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