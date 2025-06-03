// src/api/shopee/orders.js
const axios = require('axios');
const { supabase } = require('../../database');
const { generateShopeeSignature } = require('../../utils/security');

// Carregue as variáveis de ambiente de PRODUÇÃO
const SHOPEE_API_HOST = process.env.SHOPEE_API_HOST_LIVE;
const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY = process.env.SHOPEE_API_KEY_LIVE; // A Partner Key é a API Key para a assinatura

async function fetchShopeeOrders({ client_id, shop_id, access_token }) {
  const path = '/api/v2/order/get_order_list';
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    partner_key: SHOPEE_API_KEY,
    timestamp: timestamp,
  });

  // CORREÇÃO AQUI: Adicionando shop_id e access_token à URL da requisição GET/POST
  const ordersUrl = `${SHOPEE_API_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}&shop_id=${shop_id}&access_token=${access_token}`;

  try {
    const response = await axios.post(
      ordersUrl,
      {
        // Os parâmetros do corpo da requisição POST (alguns podem ser redundantes se já estiverem na URL)
        partner_id: Number(SHOPEE_PARTNER_ID), // Geralmente requerido no corpo também
        shop_id: Number(shop_id), // Geralmente requerido no corpo também
        access_token: access_token, // Geralmente requerido no corpo também
        page_size: 20, // Conforme seu requisito, pode ajustar
        // Outros parâmetros como 'time_range_field', 'time_from', 'time_to' podem ser adicionados aqui
        // para buscar pedidos em um período específico, caso contrário, pega o padrão.
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json' // Boa prática para API REST
        }
      }
    );

    console.log('✅ [fetchShopeeOrders] Resposta da Shopee:', JSON.stringify(response.data, null, 2));

    const orders = response.data.response?.order_list || [];
    console.log(`📦 [fetchShopeeOrders] Total de pedidos recebidos: ${orders.length}`);

    if (orders.length === 0) {
      console.log('📭 [fetchShopeeOrders] Nenhum pedido novo encontrado.');
      return;
    }

    // Salvar os pedidos brutos no Supabase
    for (const order of orders) {
      await supabase.from('orders_raw_shopee').insert({
        received_at: new Date().toISOString(), // Data/hora do recebimento
        client_id: client_id,
        raw_data: order, // O JSON completo do pedido
        order_id: order.order_sn, // ID do pedido da Shopee
        is_processed: false // Marcador para processamento futuro
      });
    }
    console.log(`💾 [fetchShopeeOrders] ${orders.length} pedidos Shopee salvos com sucesso na base de dados.`);

  } catch (error) {
    console.error('❌ [fetchShopeeOrders] Erro ao buscar/salvar pedidos da Shopee:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    // Para que o erro seja capturado pela função chamadora (processShopeeOrders)
    throw error;
  }
}

module.exports = {
  fetchShopeeOrders,
};