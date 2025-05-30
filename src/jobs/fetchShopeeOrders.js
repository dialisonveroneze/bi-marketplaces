// src/jobs/fetchShopeeOrders.js

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Resto do código aqui...



async function fetchShopeeOrders() {
  try {
    console.log('🔍 Buscando pedidos da Shopee...');

    // Buscar token no banco de dados
    const { data, error } = await supabase
      .from('client_connections')
      .select('access_token, client_id')
      .eq('connection_name', 'shopee')
      .single();

    if (error || !data) {
      console.error('❌ Erro ao buscar token:', error);
      return;
    }

    const accessToken = data.access_token;
    const clientId = data.client_id;

    // EXEMPLO: Pegando pedidos da Shopee
    const response = await axios.get('https://partner.shopeemobile.com/api/v2/orders/get_order_list', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const orders = response.data.orders || [];

    if (orders.length === 0) {
      console.log('📭 Nenhum pedido novo encontrado.');
      return;
    }

    // Salvar cada pedido como JSON bruto no banco de dados
    for (const order of orders) {
      await supabase.from('orders_raw_shopee').insert({
        received_at: new Date().toISOString(),
        client_id: clientId,
        raw_data: order,
        order_id: order.order_sn,
        is_processed: false
      });
    }

    console.log(`✅ ${orders.length} pedidos da Shopee salvos no banco de dados.`);
  } catch (err) {
    console.error('❌ Erro ao buscar pedidos da Shopee:', err.message);
  }
}

module.exports = fetchShopeeOrders;