// src/jobs/fetchShopeeOrders.js

const crypto = require('crypto');
require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchShopeeOrders() {
  console.log('🔍 [fetchShopeeOrders] Iniciando busca de pedidos da Shopee...');
  try {
    const { data, error } = await supabase
      .from('client_connections')
      .select('access_token, client_id, additional_data')
      .eq('connection_name', 'shopee')
      .single();

    if (error || !data) {
      console.error('❌ [fetchShopeeOrders] Erro ao buscar token:', error);
      return;
    }

    console.log('ℹ️ [fetchShopeeOrders] Dados recebidos do banco:', data);

    let additionalData = data.additional_data;

    // Se for string, parseia; se for objeto, usa direto
    if (typeof additionalData === 'string') {
      try {
        additionalData = JSON.parse(additionalData);
        console.log('✅ [fetchShopeeOrders] additional_data parseado com sucesso.');
      } catch (parseError) {
        console.error('❌ [fetchShopeeOrders] Falha ao parsear additional_data:', parseError);
        return;
      }
    } else {
      console.log('✅ [fetchShopeeOrders] additional_data já é objeto JSON');
    }

    // Extrai partner_id, partner_key e shop_id do objeto additional_data
    const partner_id = additionalData?.live?.partner_id;
    const partner_key = additionalData?.live?.partner_key;
    const shop_id = additionalData?.live?.shop_id; // Verifique se existe

    const access_token = data.access_token;
    const client_id = data.client_id;

    if (!partner_id || !partner_key || !shop_id || !access_token) {
      console.error('❌ [fetchShopeeOrders] Dados essenciais ausentes (partner_id, partner_key, shop_id ou access_token)');
      return;
    }

    console.log(`ℹ️ [fetchShopeeOrders] partner_id=${partner_id}, shop_id=${shop_id}, access_token=[OCULTO]`);

    const path = '/api/v2/order/get_order_list';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;
    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

    const url = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&access_token=${access_token}&shop_id=${shop_id}&sign=${sign}`;

    console.log('🌐 [fetchShopeeOrders] Endpoint Shopee:', url);

    const response = await axios.post(
      url,
      {
        page_size: 20
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const orders = response.data.response?.order_list || [];
    console.log(`📦 [fetchShopeeOrders] Total de pedidos recebidos: ${orders.length}`);

    if (orders.length === 0) {
      console.log('📭 [fetchShopeeOrders] Nenhum pedido novo encontrado.');
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
      console.log(`✅ [fetchShopeeOrders] Pedido ${order.order_sn} salvo no banco de dados.`);
    }

    console.log(`✅ [fetchShopeeOrders] ${orders.length} pedidos da Shopee salvos no banco de dados.`);
  } catch (err) {
    console.error('❌ [fetchShopeeOrders] Erro ao buscar pedidos da Shopee:', err.message);
  }
}

module.exports = fetchShopeeOrders;