// src/api/shopee/orders.js
const axios = require('axios');
const { generateShopeeSignature } = require('../../utils/security');
const { insertShopeeRawOrder, getClientConnection } = require('../../database');
const { refreshAccessToken } = require('./auth'); // Para renovar o token se necessário

const SHOPEE_API_HOST = process.env.SHOPEE_API_HOST_TEST; // Use _LIVE para produção
const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTNER_ID_TEST;

/**
 * Busca pedidos da Shopee para uma loja específica.
 * Implementa a lógica de paginação.
 * @param {number} clientId - ID do cliente interno da sua aplicação.
 * @param {number} shopId - ID da loja Shopee.
 * @param {string} [cursor=''] - Cursor para paginação.
 * @param {number} [pageSize=20] - Número de pedidos por página.
 * @param {number} [timeFrom] - Timestamp inicial para buscar pedidos.
 * @param {number} [timeTo] - Timestamp final para buscar pedidos.
 */
async function fetchShopeeOrders(clientId, shopId, cursor = '', pageSize = 20, timeFrom, timeTo) {
  const path = '/api/v2/order/get_order_list'; // Exemplo de endpoint para listar pedidos
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp em segundos

  let clientConnection;
  try {
    clientConnection = await getClientConnection(clientId, 'shopee');
    if (!clientConnection || !clientConnection.access_token) {
      throw new Error(`Conexão Shopee não encontrada ou access_token ausente para o cliente ${clientId}.`);
    }

    // Verifica se o token está próximo de expirar e tenta renovar
    const expiresAt = new Date(clientConnection.additional_data.expires_at);
    // Renovar se expirar em menos de 10 minutos (600 segundos)
    if (expiresAt < new Date(Date.now() + 600 * 1000)) {
      console.log(`⏰ Access Token da Shopee para o cliente ${clientId} está expirando. Tentando renovar...`);
      const { access_token: newAccessToken, refresh_token: newRefreshToken } =
        await refreshAccessToken(clientConnection.refresh_token, shopId, clientId);
      clientConnection.access_token = newAccessToken; // Atualiza o token na memória
      clientConnection.refresh_token = newRefreshToken;
      console.log('✅ Access Token da Shopee renovado com sucesso.');
    }

  } catch (dbError) {
    console.error(`❌ Erro ao obter/renovar token do cliente ${clientId}:`, dbError.message);
    return; // Interrompe a execução se não conseguir o token
  }

  const { access_token } = clientConnection;
  const sign = generateShopeeSignature(SHOPEE_API_KEY, path, timestamp, access_token, shopId);

  const ordersUrl = `${SHOPEE_API_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  let allOrders = [];
  let currentCursor = cursor;
  let hasMore = true;
  let page = 0;

  while (hasMore) {
    console.log(`🌐 [fetchShopeeOrders] Buscando página ${page + 1} para o cliente ${clientId}, loja ${shopId}...`);
    const requestBody = {
      partner_id: Number(SHOPEE_PARTNER_ID),
      shop_id: Number(shopId),
      access_token: access_token,
      page_size: pageSize,
      cursor: currentCursor, // Passa o cursor para a próxima página
      // Adicione filtros de tempo se desejar
      // time_from: timeFrom,
      // time_to: timeTo,
    };

    try {
      const response = await axios.post(
        ordersUrl,
        requestBody,
        { headers: { 'Content-Type': 'application/json' } }
      );

      // console.log('✅ [fetchShopeeOrders] Resposta da Shopee:', JSON.stringify(response.data, null, 2));

      const { order_list, next_cursor, more } = response.data.response || {};
      const orders = order_list || [];

      console.log(`📦 [fetchShopeeOrders] Total de pedidos recebidos na página ${page + 1}: ${orders.length}`);

      if (orders.length > 0) {
        allOrders = allOrders.concat(orders);
        for (const order of orders) {
          await insertShopeeRawOrder({
            received_at: new Date().toISOString(),
            client_id: clientId,
            raw_data: order,
            order_id: order.order_sn,
            is_processed: false,
          });
        }
      }

      hasMore = more; // A Shopee retorna 'more' como true/false
      currentCursor = next_cursor; // Atualiza o cursor para a próxima requisição
      page++;

      if (hasMore && next_cursor) {
        // Pequena pausa para evitar limites de rate limit, se necessário
        // await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log('📭 [fetchShopeeOrders] Todos os pedidos foram buscados ou nenhum pedido novo encontrado.');
        break; // Sai do loop se não houver mais páginas ou cursor
      }

    } catch (error) {
      console.error('❌ Erro ao buscar pedidos da Shopee:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
      // Se for um erro de token expirado, você pode tentar renovar e re-chamar,
      // mas isso pode levar a loops infinitos se a renovação também falhar.
      // A lógica de renovação antecipada em `auth.js` ajuda a mitigar isso.
      hasMore = false; // Parar o loop em caso de erro
    }
  }

  console.log(`🎉 [fetchShopeeOrders] Concluído. Total de pedidos salvos: ${allOrders.length}`);
  return allOrders;
}

module.exports = {
  fetchShopeeOrders,
};