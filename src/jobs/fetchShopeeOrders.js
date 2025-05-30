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
    console.log('🔍 [fetchShopeeOrders] Iniciando busca de pedidos da Shopee...');

    // Buscar token e dados adicionais do banco
    const { data, error } = await supabase
      .from('client_connections')
      .select('access_token, client_id, additional_data')
      .eq('connection_name', 'shopee')
      .single();

    if (error || !data) {
      console.error('❌ [fetchShopeeOrders] Erro ao buscar token no banco:', error);
      return;
    }

    console.log('ℹ️ [fetchShopeeOrders] Dados recebidos do banco:', data);

    const { access_token, client_id, additional_data } = data;

    // Verificação se additional_data é string ou objeto
    let additionalParsed;
    if (typeof additional_data === 'string') {
      try {
        additionalParsed = JSON.parse(additional_data);
        console.log('✅ [fetchShopeeOrders] additional_data parseado com sucesso');
      } catch (parseErr) {
        console.error('❌ [fetchShopeeOrders] Falha ao parsear additional_data:', parseErr);
        return;
      }
    } else if (typeof additional_data === 'object' && additional_data !== null) {
      additionalParsed = additional_data;
      console.log('✅ [fetchShopeeOrders] additional_data já é objeto JSON');
    } else {
      console.error('❌ [fetchShopeeOrders] additional_data é inválido ou ausente');
      return;
    }

    // Extrair os dados essenciais para montar a chamada
    const partner_id = additionalParsed.live?.partner_id;
    const partner_key = additionalParsed.live?.partner_key;
    const shop_id = additionalParsed.live?.shop_id;

    console.log(`ℹ️ [fetchShopeeOrders] partner_id=${partner_id}, partner_key=${partner_key ? '[OCULTO]' : 'NÃO DEFINIDO'}, shop_id=${shop_id}`);

    if (!partner_id || !partner_key || !shop_id || !access_token) {
      console.error('❌ [fetchShopeeOrders] Dados essenciais ausentes (partner_id, partner_key, shop_id ou access_token)');
      return;
    }

    // Montagem da assinatura e URL conforme documentação Shopee
    const path = '/api/v2/order/get_order_list';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;
    console.log(`[fetchShopeeOrders] baseString para assinatura: ${baseString}`);

    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

    const url = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&access_token=${access_token}&shop_id=${shop_id}&sign=${sign}`;

    console.log(`[fetchShopeeOrders] URL gerada para requisição: ${url}`);

    // Fazer a chamada para buscar pedidos
    const response = await axios.post(
      url,
      { page_size: 20 },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const orders = response.data.response?.order_list || [];

    console.log(`[fetchShopeeOrders] Total de pedidos recebidos: ${orders.length}`);

    if (orders.length === 0) {
      console.log('[fetchShopeeOrders] Nenhum pedido novo encontrado.');
      return;
    }

    // Inserir os pedidos no banco
    for (const order of orders) {
      await supabase.from('orders_raw_shopee').insert({
        received_at: new Date().toISOString(),
        client_id,
        raw_data: order,
        order_id: order.order_sn,
        is_processed: false
      });
      console.log(`[fetchShopeeOrders] Pedido ${order.order_sn} salvo no banco de dados.`);
    }

    console.log(`[fetchShopeeOrders] ${orders.length} pedidos da Shopee salvos com sucesso.`);
  } catch (err) {
    console.error(`[fetchShopeeOrders] Erro inesperado: ${err.message}`);
    console.error(err.stack);
  }
}

module.exports = fetchShopeeOrders;
