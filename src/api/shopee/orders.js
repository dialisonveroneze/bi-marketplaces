// src/api/shopee/orders.js
const axios = require('axios');
const { supabase } = require('../../database');
const { generateShopeeSignature } = require('../../utils/security'); // Certifique-se de que o caminho está correto

// Variáveis de ambiente - Certifique-se de que estão definidas
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE;
const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE;

/**
 * Busca pedidos da Shopee para uma determinada loja e os salva no banco de dados.
 *
 * @param {string} shopId O ID da loja Shopee.
 * @param {string} accessToken O access token válido para a loja.
 * @param {string} connectionId O ID da conexão no Supabase para esta loja.
 * @returns {Array} Uma lista dos pedidos processados.
 * @throws {Error} Se a requisição à Shopee falhar ou os pedidos não puderem ser salvos.
 */
async function fetchShopeeOrders(shopId, accessToken, connectionId) {
  console.log(`[DEBUG_SHOPEE] fetchShopeeOrders chamada para Shop ID: ${shopId}`);
  console.log(`[DEBUG_SHOPEE] access_token recebido (parcial): ${accessToken ? accessToken.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);

  const path = '/api/v2/order/get_order_list';
  const timestamp = Math.floor(Date.now() / 1000);

  // Parâmetros de query para a requisição de pedidos
  // Ajuste estes parâmetros conforme a necessidade da sua lógica (ex: datas, status)
  const queryParams = {
    partner_id: Number(SHOPEE_PARTNER_ID_LIVE),
    shop_id: Number(shopId),
    timestamp: timestamp,
    // Estes são exemplos de parâmetros. Adicione os que você precisa.
    // status: 'UNPAID', // Exemplo: buscar apenas pedidos não pagos
    // create_time_from: Math.floor((Date.now() - (7 * 24 * 60 * 60 * 1000)) / 1000), // Pedidos dos últimos 7 dias
    // create_time_to: timestamp,
    // page_size: 100, // Número de pedidos por página (máximo 100)
    // cursor: '', // Para paginação, se necessário
  };

  // Log dos parâmetros que serão usados na assinatura
  console.log('[DEBUG_SHOPEE] Gerando assinatura com os seguintes parâmetros:');
  console.log(`  - path: ${path}`);
  console.log(`  - partner_id: ${queryParams.partner_id}`);
  console.log(`  - timestamp: ${queryParams.timestamp}`);
  console.log(`  - shop_id: ${queryParams.shop_id}`);
  console.log(`  - access_token (parcial para assinatura): ${accessToken ? accessToken.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);
  // Inclua outros queryParams aqui se eles fizerem parte da assinatura
  // Fora do partner_key, a string base para a assinatura de API de dados da Shopee é:
  // partner_id + path + timestamp + access_token + shop_id
  const baseStringForOrdersSign = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}${accessToken}${shopId}`;


  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID_LIVE,
    partner_key: SHOPEE_API_KEY_LIVE,
    timestamp: timestamp,
    access_token: accessToken,
    shop_id: shopId,
    // Inclua outros queryParams que são parte da assinatura aqui, se houver
  }, baseStringForOrdersSign);

  // Constrói a URL da requisição de pedidos
  const ordersUrl = `${SHOPEE_API_HOST_LIVE}${path}?access_token=${accessToken}&partner_id=${queryParams.partner_id}&shop_id=${queryParams.shop_id}&timestamp=${queryParams.timestamp}&sign=${sign}`;
  // Se você tiver outros queryParams que NÃO fazem parte da assinatura, adicione-os aqui no final da URL
  // Ex: ordersUrl += `&status=${queryParams.status}&page_size=${queryParams.page_size}`;

  console.log(`DEBUG: Final ordersUrl antes do axios.get (query completa e ordenada): ${ordersUrl}`);

  try {
    const response = await axios.get(ordersUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // --- NOVO LOG CRÍTICO AQUI: RESPOSTA RAW DA SHOPEE PARA PEDIDOS ---
    console.log('--- DEBUG: Resposta RAW da Shopee para GetOrdersList ---');
    console.log(JSON.stringify(response.data, null, 2));
    console.log(`--- DEBUG: Status HTTP da Resposta de Pedidos: ${response.status} ---`);
    console.log('----------------------------------------------------');
    // --- FIM DO NOVO LOG CRÍTICO ---

    // A partir daqui, você processaria a resposta da Shopee
    // Verifique a estrutura real da resposta nos logs para saber como desestruturar
    // Exemplo:
    if (response.data && response.data.response && Array.isArray(response.data.response.order_list)) {
      const orders = response.data.response.order_list;
      console.log(`[DEBUG_SHOPEE] Encontrados ${orders.length} pedidos.`);

      // Exemplo de como você salvaria no Supabase
      // Lembre-se de adaptar para a sua tabela de pedidos
      /*
      const { error: insertError } = await supabase
        .from('shopee_orders') // Substitua pelo nome da sua tabela de pedidos
        .upsert(orders.map(order => ({
          connection_id: connectionId,
          order_sn: order.order_sn,
          order_status: order.order_status,
          // Mapeie outros campos relevantes aqui
        })), { onConflict: ['order_sn'], ignoreDuplicates: false }); // Ajuste a onConflict para sua PK

      if (insertError) {
        console.error('❌ [fetchShopeeOrders] Erro ao salvar pedidos no Supabase:', insertError.message);
        throw insertError;
      }
      console.log(`✅ [fetchShopeeOrders] ${orders.length} pedidos salvos/atualizados no Supabase.`);
      */
      return orders;

    } else if (response.data.error || response.data.message) {
        // Se a Shopee retornar um erro no nível superior da resposta
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