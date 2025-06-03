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

  // AGORA PASSAMOS shop_id e access_token para generateShopeeSignature
  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    partner_key: SHOPEE_API_KEY,
    timestamp: timestamp,
    shop_id: shop_id,       // NOVO: Adicionado aqui
    access_token: access_token // NOVO: Adicionado aqui
  });

  // A URL já tinha shop_id e access_token, o que é necessário para a requisição.
  // A assinatura agora também os inclui.
  const ordersUrl = `<span class="math-inline">\{SHOPEE\_API\_HOST\}</span>{path}?partner_id=<span class="math-inline">\{SHOPEE\_PARTNER\_ID\}&timestamp\=</span>{timestamp}&sign=<span class="math-inline">\{sign\}&shop\_id\=</span>{shop_id}&access_token=${access_token}`;

  try {
    const response = await axios.post(
      ordersUrl,
      {
        partner_id: Number(SHOPEE_PARTNER_ID),
        shop_id: Number(shop_id),
        access_token: access_token,
        page_size: 20,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
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
        received_at: new Date().toISOString(),
        client_id: client_id,
        raw_data: order,
        order_id: order.order_sn,
        is_processed: false
      });
    }
    console.log(`💾 [fetchShopeeOrders] ${orders.length} pedidos Shopee salvos com sucesso na base de dados.`);

  } catch (error) {
    console.error('❌ [fetchShopeeOrders] Erro ao buscar/salvar pedidos da Shopee:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    throw error;
  }
}

module.exports = {
  fetchShopeeOrders,
};