// src/api/shopee/orders.js
const axios = require('axios');
const { supabase } = require('../../database');
const { generateShopeeSignature } = require('../../utils/security');

const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE;
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE;

async function fetchShopeeOrders(shopId, accessToken, connectionId) {
  console.log(`[DEBUG_SHOPEE] fetchShopeeOrders chamada para Shop ID: ${shopId}`);
  console.log(`[DEBUG_SHOPEE] access_token recebido (parcial): ${accessToken ? accessToken.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);

  const path = '/api/v2/order/get_order_list';
  const timestamp = Math.floor(Date.now() / 1000);

  const sevenDaysAgo = Math.floor((Date.now() - (7 * 24 * 60 * 60 * 1000)) / 1000);

  const queryParams = {
    partner_id: Number(SHOPEE_PARTNER_ID_LIVE),
    shop_id: Number(shopId),
    timestamp: timestamp,
    time_from: sevenDaysAgo,
    time_to: timestamp,
    time_range_field: 'create_time',
    page_size: 100,
    // ADICIONE response_optional_fields PARA OBTER MAIS DETALHES DE UMA VEZ
    // Isso evita ter que fazer um get_order_detail separado para cada pedido.
    // Consulte a documentação da Shopee para ver quais campos você pode solicitar.
    // Ex: response_optional_fields: 'order_status,payment_info,recipient_address,items',
    // Isso é crucial se você precisar de mais do que apenas o order_sn.
    response_optional_fields: 'order_status,payment_info,recipient_address,items', // EX: Adicione os campos necessários
  };

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

  const baseStringForOrdersSign = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}${accessToken}${shopId}`;

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
  }, baseStringForOrdersSign);

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
  // Adiciona response_optional_fields se existir e estiver preenchido
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
        // Prepare os dados para inserção/atualização no Supabase
        const ordersToUpsert = orders.map(order => ({
          connection_id: connectionId,
          order_sn: order.order_sn,
          // Mapeie outros campos relevantes aqui se response_optional_fields estiver trazendo-os
          // Por exemplo, se você pediu 'order_status' e 'create_time':
          order_status: order.order_status || 'UNKNOWN', // Adicione um fallback se o campo não estiver sempre presente
          create_time: order.create_time ? new Date(order.create_time * 1000).toISOString() : null, // Converta timestamp para ISO string
          update_time: order.update_time ? new Date(order.update_time * 1000).toISOString() : null,
          // Salve todos os dados brutos do pedido na coluna JSONB (muito recomendado!)
          raw_data: order,
        }));

        console.log(`[DEBUG_SHOPEE] Preparando ${ordersToUpsert.length} pedidos para upsert no Supabase.`);
        
        const { error: insertError } = await supabase
          .from('shopee_orders') // Certifique-se de que este é o nome correto da sua tabela
          .upsert(ordersToUpsert, { 
            onConflict: ['order_sn'], // Conflito no order_sn significa que o pedido já existe, então atualize
            ignoreDuplicates: false // Permite a atualização
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