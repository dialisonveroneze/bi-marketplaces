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
 * @param {number} shopId O ID da loja Shopee (agora garantido que é um número).
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
    shop_id: Number(shopId), // Garantido como número agora
    timestamp: timestamp,
    // --- MUDANÇA CRÍTICA AQUI: ADICIONANDO time_from e time_to ---
    time_from: sevenDaysAgo, // Busca pedidos dos últimos 7 dias
    time_to: timestamp,      // Até agora
    // Outros parâmetros úteis (descomente/ajuste conforme necessário)
    page_size: 100, // Número de pedidos por página (máximo 100)
    // order_status: 'READY_TO_SHIP', // Exemplo: buscar apenas pedidos prontos para envio
    // response_optional_fields: 'order_status,payment_info', // Campos adicionais na resposta
    // cursor: '', // Para paginação, se necessário
  };

  // Log dos parâmetros que serão usados na assinatura
  console.log('[DEBUG_SHOPEE] Gerando assinatura com os seguintes parâmetros:');
  console.log(`  - path: ${path}`);
  console.log(`  - partner_id: ${queryParams.partner_id}`);
  console.log(`  - timestamp: ${queryParams.timestamp}`);
  console.log(`  - shop_id: ${queryParams.shop_id}`);
  console.log(`  - access_token (parcial para assinatura): ${accessToken ? accessToken.substring(0, 10) + '...' : 'NULO/UNDEFINED'}`);
  console.log(`  - time_from: ${queryParams.time_from}`); // Adicionado
  console.log(`  - time_to: ${queryParams.time_to}`);     // Adicionado
  console.log(`  - page_size: ${queryParams.page_size}`); // Adicionado se for usado na assinatura

  // A base string para a assinatura de API de dados da Shopee é:
  // partner_id + path + timestamp + access_token + shop_id + [outros_parametros_ordenados_alfabeticamente]
  // Note: time_from e time_to devem ser incluídos na assinatura se usados.
  const baseStringForOrdersSign = `${SHOPEE_PARTNER_ID_LIVE}${path}${timestamp}${accessToken}${shopId}`;

  // A função generateShopeeSignature já ordena e inclui todos os queryParams
  // automaticamente se passados como objeto, mas é bom verificar sua implementação.
  // Se a sua generateShopeeSignature só espera um `baseString` fixo, você precisa
  // ajustar ela ou criar a string completa manualmente, garantindo a ordem alfabética
  // dos parâmetros no URL e na string de assinatura.

  // Para garantir a ordem alfabética dos parâmetros na URL e na assinatura:
  // 1. Crie um objeto com TODOS os parâmetros da URL, incluindo access_token e sign (que será adicionado depois)
  // 2. Converta para uma string de query, ordenando as chaves alfabeticamente.
  // A generateShopeeSignature deve lidar com isso. Vamos passar todos os queryParams para ela.

  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID_LIVE,
    partner_key: SHOPEE_API_KEY_LIVE,
    timestamp: timestamp,
    access_token: accessToken,
    shop_id: shopId,
    // Inclua os parâmetros de tempo aqui também para que sejam considerados na assinatura
    time_from: queryParams.time_from,
    time_to: queryParams.time_to,
    page_size: queryParams.page_size,
    // Adicione qualquer outro queryParam que você usar na URL e na assinatura
  }, baseStringForOrdersSign); // A baseStringForOrdersSign ainda é a base, mas os parâmetros reais vêm do objeto

  // Constrói a URL da requisição de pedidos, garantindo a inclusão de todos os parâmetros
  // É crucial que a ordem dos parâmetros na URL corresponda à ordem usada para gerar a assinatura.
  // Shopee exige que os parâmetros da URL estejam em ordem alfabética (exceto sign, que é o último).
  // Vamos construir a URL de forma mais robusta.
  const orderedQueryParams = {
    access_token: accessToken,
    partner_id: queryParams.partner_id,
    shop_id: queryParams.shop_id,
    timestamp: queryParams.timestamp,
    time_from: queryParams.time_from,
    time_to: queryParams.time_to,
    page_size: queryParams.page_size,
    // Adicione quaisquer outros parâmetros aqui e eles serão ordenados
  };

  const queryString = Object.keys(orderedQueryParams)
    .sort() // Ordena as chaves alfabeticamente
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

      // Implemente a lógica para salvar os pedidos no Supabase aqui.
      // Exemplo:
      /*
      const { error: insertError } = await supabase
        .from('shopee_orders') // Substitua pelo nome da sua tabela de pedidos
        .upsert(orders.map(order => ({
          connection_id: connectionId,
          order_sn: order.order_sn,
          order_status: order.order_status,
          // Mapeie outros campos relevantes aqui
        })), { onConflict: ['order_sn'], ignoreDuplicates: false });

      if (insertError) {
        console.error('❌ [fetchShopeeOrders] Erro ao salvar pedidos no Supabase:', insertError.message);
        throw insertError;
      }
      console.log(`✅ [fetchShopeeOrders] ${orders.length} pedidos salvos/atualizados no Supabase.`);
      */
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