const axios = require('axios');
const { supabase } = require('../../database');
const { generateShopeeSignature } = require('../../utils/security');

// Carregue as variáveis de ambiente de PRODUÇÃO
const SHOPEE_API_HOST = process.env.SHOPEE_API_HOST_LIVE;
const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY = process.env.SHOPEE_API_KEY_LIVE; // A Partner Key é a API Key para a assinatura

async function fetchShopeeOrders({ client_id, shop_id, access_token }) {
  // --- INÍCIO DOS NOVOS LOGS PARA DIAGNÓSTICO DO TOKEN ---

  // 1. Log inicial: Confirma que a função foi chamada e quais tokens recebeu
  console.log('[DEBUG_SHOPEE] fetchShopeeOrders chamada para Client ID:', client_id, 'Shop ID:', shop_id);
  console.log('[DEBUG_SHOPEE] access_token recebido (parcial):', access_token ? access_token.substring(0, 10) + '...' : 'NULO/UNDEFINED');
  // Se você tiver o refresh_token disponível aqui, também seria útil logá-lo:
  // console.log('[DEBUG_SHOPEE] refresh_token disponível (parcial):', refresh_token ? refresh_token.substring(0, 10) + '...' : 'NULO/UNDEFINED');
  // Se você tiver a data de expiração, logue-a também:
  // console.log('[DEBUG_SHOPEE] Token expiry (se disponível):', expiry_date);


  const path = '/api/v2/order/get_order_list';
  const timestamp = Math.floor(Date.now() / 1000);

  // 2. Log antes de gerar a assinatura: Confirma os inputs para a assinatura
  console.log('[DEBUG_SHOPEE] Gerando assinatura com os seguintes parâmetros:');
  console.log('  - path:', path);
  console.log('  - partner_id:', SHOPEE_PARTNER_ID);
  console.log('  - timestamp:', timestamp);
  console.log('  - shop_id:', shop_id);
  console.log('  - access_token (parcial para assinatura):', access_token ? access_token.substring(0, 10) + '...' : 'NULO/UNDEFINED');


  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    partner_key: SHOPEE_API_KEY,
    timestamp: timestamp,
    shop_id: shop_id,
    access_token: access_token
  });

  // 3. Log da assinatura gerada
  console.log('[DEBUG_SHOPEE] Assinatura (sign) gerada:', sign);

  // --- FIM DOS NOVOS LOGS ANTES DA REQUISIÇÃO ---


  // CORREÇÃO FINAL DA URL: Inclui todos os parâmetros necessários na query string, em ordem alfabética, com o 'sign' por último.
  const ordersUrl = `${SHOPEE_API_HOST}${path}?access_token=${access_token}&partner_id=${SHOPEE_PARTNER_ID}&shop_id=${shop_id}&timestamp=${timestamp}&sign=${sign}`;

  console.log('DEBUG: Final ordersUrl antes do axios.post (query completa e ordenada):', ordersUrl);

  try {
    const response = await axios.post(
      ordersUrl,
      {
        // Os parâmetros no corpo são geralmente redundantes se já estiverem na URL para alguns endpoints POST,
        // mas é boa prática mantê-los se a documentação não for explícita.
        partner_id: Number(SHOPEE_PARTNER_ID),
        shop_id: Number(shop_id),
        access_token: access_token, // Este é o access_token usado no corpo da requisição
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
    // 4. Log aprimorado do erro
    console.error('❌ [fetchShopeeOrders] Erro ao buscar/salvar pedidos da Shopee:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);

    // Adiciona uma sugestão específica se o erro for 403 e tiver a mensagem de token inválido
    if (error.response && error.response.status === 403 && error.response.data.error === 'invalid_access_token') {
      console.error('[DEBUG_SHOPEE] ERRO 403: O access_token utilizado pode estar expirado ou inválido. Considere acionar o processo de refresh_token para esta loja.');
    } else if (error.response && error.response.status === 403) {
      console.error('[DEBUG_SHOPEE] ERRO 403: Acesso negado. Pode ser problema de permissão ou token inválido (não especificado).');
    }
    throw error;
  }
}

module.exports = {
  fetchShopeeOrders,
};