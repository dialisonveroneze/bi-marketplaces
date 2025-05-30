// src/jobs/fetchShopeeOrders.js

const crypto = require('crypto');
require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchShopeeOrders() {
  try {
    console.log('🔍 Buscando pedidos da Shopee...');

    const { data, error } = await supabase
      .from('client_connections')
      .select('access_token, client_id, additional_data')
      .eq('connection_name', 'shopee')
      .single();

    if (error || !data) {
      console.error('❌ Erro ao buscar token:', error);
      return;
    }

    const { access_token, client_id, additional_data } = data;

    // Parsear o campo JSON "additional_data"
    let partner_id, partner_key, shop_id;
    try {
      const additional = typeof additional_data === 'string'
        ? JSON.parse(additional_data)
        : additional_data;

      partner_id = additional.live.partner_id;
      partner_key = additional.live.partner_key;
      shop_id = additional.live.shop_id || 'shop_id_aqui';  // Ajuste conforme necessário
    } catch (parseError) {
      console.error('❌ Erro ao parsear additional_data:', parseError);
      return;
    }

    const path = '/api/v2/order/get_order_list';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;
    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');
    const url = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&access_token=${access_token}&shop_id=${shop_id}&sign=${sign}`;

    console.log('🌐 Endpoint Shopee:', url);

    const response = await axios.post(
      url,
      { page_size: 20 },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const orders = response.data.response?.order_list || [];
    console.log(`📦 Total de pedidos recebidos: ${orders.length}`);

    if (orders.length === 0) {
      console.log('📭 Nenhum pedido novo encontrado.');
      return;
    }

    for (const order of orders) {
      await supabase.from('orders_raw_shopee').insert({
        received_at: new Date().toISOString(),
        client_id,
        raw_data: order,
        order_id: order.order_sn,
        is_processed: false
      });
      console.log(`✅ Pedido ${order.order_sn} salvo no banco de dados.`);
    }

    console.log(`✅ ${orders.length} pedidos da Shopee salvos no banco de dados.`);
  } catch (err) {
    console.error('❌ Erro ao buscar pedidos da Shopee:', err.message);
  }
}

module.exports = fetchShopeeOrders;