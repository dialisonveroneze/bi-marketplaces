// src/services/orderProcessor.js
const { supabase } = require('../database');
const { fetchShopeeOrders } = require('../api/shopee/orders');
// const { refreshShopeeToken } = require('../api/shopee/auth'); // Iremos criar essa no futuro

async function processShopeeOrders() {
  console.log('🔄 [processShopeeOrders] Iniciando o processamento de pedidos Shopee...');

  try {
    // 1. Obter todas as conexões Shopee ativas do banco de dados
    // Selecionamos as informações necessárias para buscar e salvar pedidos
    const { data: connections, error } = await supabase
      .from('client_connections')
      .select('id, client_id, access_token, refresh_token, additional_data') // Incluímos 'id' da conexão para futuras atualizações
      .eq('connection_name', 'shopee'); // Filtrar apenas conexões da Shopee

    if (error) {
      console.error('❌ [processShopeeOrders] Erro ao buscar conexões Shopee:', error.message);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('📭 [processShopeeOrders] Nenhuma conexão Shopee encontrada para processar.');
      return;
    }

    console.log(`📦 [processShopeeOrders] Encontradas ${connections.length} conexões Shopee para processar.`);

    for (const connection of connections) {
      const { id: connection_id, client_id, access_token, refresh_token, additional_data } = connection;
      const shop_id = additional_data?.shop_id; // Extrair o shop_id de additional_data

      if (!shop_id) {
        console.warn(`⚠️ [processShopeeOrders] Conexão Shopee (ID: ${connection_id}) para client_id ${client_id} sem shop_id. Pulando.`);
        continue;
      }

      console.log(`🛍️ [processShopeeOrders] Processando pedidos para Shop ID: ${shop_id} (Client ID: ${client_id})`);

      try {
        // Chamamos a função fetchShopeeOrders que você já deve ter ou que criaremos
        await fetchShopeeOrders({ client_id, shop_id, access_token });
        console.log(`✅ [processShopeeOrders] Pedidos para Shop ID: ${shop_id} processados com sucesso.`);
      } catch (orderError) {
        console.error(`❌ [processShopeeOrders] Erro ao buscar pedidos para Shop ID ${shop_id}:`, orderError.response ? JSON.stringify(orderError.response.data, null, 2) : orderError.message);

        // TODO: Aqui vamos adicionar a lógica para renovar o token se ele estiver expirado
        // if (orderError.response && orderError.response.data?.message === 'access_token_expired') {
        //   console.log('🔄 Tentando renovar o token...');
        //   try {
        //     const newTokens = await refreshShopeeToken(refresh_token);
        //     // Atualize o DB com newTokens.access_token e newTokens.refresh_token
        //     // E tente fetchShopeeOrders novamente com o novo token
        //   } catch (refreshError) {
        //     console.error('❌ Erro ao renovar token:', refreshError.message);
        //   }
        // }
      }
    }
    console.log('🎉 [processShopeeOrders] Processamento de pedidos Shopee concluído.');

  } catch (globalError) {
    console.error('🔥 [processShopeeOrders] Erro global no processamento de pedidos Shopee:', globalError.message);
  }
}

module.exports = {
  processShopeeOrders,
};