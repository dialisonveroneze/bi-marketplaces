// src/api/shopee/orders.js
const axios = require('axios');
const { supabase } = require('../../database');
const { generateShopeeSignature } = require('../../utils/security');

// Variáveis de ambiente - Certifique-se de que estão definidas
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE;
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE;

/**
 * Busca detalhes de pedidos da Shopee para uma determinada loja e os salva no banco de dados.
 *
 * NOTA: Esta função agora buscará os detalhes completos dos pedidos usando
 * o endpoint get_order_detail, que requer uma lista de order_sn.
 * Para simplificar o teste inicial, vamos simular esta lista.
 * Em um cenário real, você buscaria os order_sn com get_order_list primeiro.
 *
 * @param {number} shopId O ID da loja Shopee.
 * @param {string} accessToken O access token válido para a loja.
 * @param {string} connectionId O ID da conexão no Supabase para esta loja (usado como client_id).
 * @returns {Array} Uma lista dos pedidos processados.
 * @throws {Error} Se a requisição à Shopee falhar ou os pedidos não puderem ser salvos.
 */
async function fetchShopeeOrders(shopId, accessToken, connectionId) {
  console.log(`[DEBUG_SHOPEE] fetchShopeeOrders (Get Order Detail) chamada para Shop ID: ${shopId}`);
  console.log(`[DEBUG_SHOPEE] access_token recebido (parcial): ${accessToken ? accessToken.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);
  console.log(`[DEBUG_SHOPEE] connectionId recebido: ${connectionId}`);

  // --- ALTERAÇÕES AQUI ---
  // 1. Mudança de Endpoint
  const path = '/api/v2/order/get_order_detail';
  const timestamp = Math.floor(Date.now() / 1000); // Timestamp atual em segundos

  // 2. Parâmetros para get_order_detail
  // Para testar, precisamos de alguns Order SNs válidos.
  // Em produção, esses Order SNs viriam de uma chamada prévia a get_order_list.
  // Por ora, vamos pegar os primeiros da sua lista para teste.
  // Se você limpou a tabela, e não tem order_sn's recentes, pode ter que pegar
  // alguns da documentação da Shopee ou de um pedido real recente na sua conta.
  // Vou colocar alguns exemplos fictícios, ajuste se necessário.
  const sampleOrderSNs = [
      "250604KPPCYPKG", // Exemplo de Order SNs que apareceram nos seus logs anteriores
      "250604KPPTA2C6",
      "250604KPUY8PVE",
      "250604KPW5E82Y",
      "250604KQQM9RW5"
  ];

  // Adicionar mais SNs até o limite (50 ou 100).
  // Se você tiver uma maneira de obter uma lista maior e real de Order SNs,
  // substitua `sampleOrderSNs` por essa lista.
  // Por exemplo, você poderia buscar os `order_id`s já salvos na sua tabela.
  const order_sn_list = sampleOrderSNs; // Usaremos esta lista para a requisição

  // Campos opcionais para get_order_detail
  const response_optional_fields = 'item_list,recipient_address,payment_info';

  const queryParams = {
    partner_id: Number(SHOPEE_PARTNER_ID_LIVE),
    shop_id: Number(shopId),
    timestamp: timestamp,
    order_sn_list: order_sn_list.join(','), // A API espera uma string separada por vírgulas
    response_optional_fields: response_optional_fields,
  };

  // Log dos parâmetros que serão usados na assinatura
  console.log('[DEBUG_SHOPEE] Gerando assinatura com os seguintes parâmetros:');
  console.log(`  - path: ${path}`);
  console.log(`  - partner_id: ${queryParams.partner_id}`);
  console.log(`  - timestamp: ${queryParams.timestamp}`);
  console.log(`  - shop_id: ${queryParams.shop_id}`);
  console.log(`  - access_token (parcial para assinatura): ${accessToken ? accessToken.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);
  console.log(`  - order_sn_list: ${queryParams.order_sn_list}`);
  console.log(`  - response_optional_fields: ${queryParams.response_optional_fields}`);

  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID_LIVE,
    partner_key: SHOPEE_API_KEY_LIVE,
    timestamp: timestamp,
    access_token: accessToken,
    shop_id: shopId,
    order_sn_list: queryParams.order_sn_list, // Deve ser a string separada por vírgulas
    response_optional_fields: queryParams.response_optional_fields,
  });

  // A ordem dos parâmetros na queryString é crucial para a assinatura
  const orderedQueryParams = {
    access_token: accessToken,
    partner_id: queryParams.partner_id,
    order_sn_list: queryParams.order_sn_list, // Certifique-se de que é a string
    shop_id: queryParams.shop_id,
    timestamp: queryParams.timestamp,
    response_optional_fields: queryParams.response_optional_fields, // Deve vir ordenado
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
      const orders = response.data.response.order_list; // A resposta ainda vem em 'order_list'
      console.log(`[DEBUG_SHOPEE] Encontrados ${orders.length} detalhes de pedidos.`);

      if (orders.length > 0) {
        const ordersToUpsert = orders.map(order => ({
          client_id: 1, // Mantemos fixo como débito técnico, conforme acordado
          order_id: order.order_sn, // order_sn é o ID do pedido
          raw_data: order, // Salva o objeto de detalhe de pedido completo
        }));

        console.log(`[DEBUG_SHOPEE] Preparando ${ordersToUpsert.length} detalhes de pedidos para upsert no Supabase.`);
        
        const { error: insertError } = await supabase
          .from('orders_raw_shopee')
          .upsert(ordersToUpsert, { 
            onConflict: ['order_id'], // Usa order_id para conflito (upsert)
            ignoreDuplicates: false
          });

        if (insertError) {
          console.error('❌ [fetchShopeeOrders] Erro ao salvar detalhes de pedidos no Supabase:', insertError.message);
          throw insertError;
        }
        console.log(`✅ [fetchShopeeOrders] ${orders.length} detalhes de pedidos salvos/atualizados no Supabase.`);
      } else {
        console.log('[DEBUG_SHOPEE] Nenhuns detalhes de pedidos para salvar no Supabase.');
      }
      
      return orders;

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