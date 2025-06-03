// src/controllers/shopeeController.js
const { supabase } = require('../database');
const { refreshShopeeAccessToken } = require('../api/shopee/auth');
const { fetchShopeeOrders } = require('../api/shopee/orders');

/**
 * Processa todos os pedidos da Shopee para todas as lojas conectadas.
 */
async function processShopeeOrders() {
  console.log('🔄 [processShopeeOrders] Iniciando o processamento de pedidos Shopee...');

  try {
    // 1. Obter todas as conexões Shopee ativas do Supabase
    const { data: connections, error } = await supabase
      .from('client_connections')
      .select('*')
      .eq('connection_name', 'shopee');

    if (error) {
      console.error('❌ [processShopeeOrders] Erro ao buscar conexões no Supabase:', error.message);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('📦 [processShopeeOrders] Nenhuma conexão Shopee encontrada para processar.');
      return;
    }

    console.log(`📦 [processShopeeOrders] Encontradas ${connections.length} conexões Shopee para processar.`);

    for (const connection of connections) { // Usar for...of para await em loop
      const { id: connectionId, client_id, shop_id, access_token, refresh_token, access_token_expires_at } = connection;
      console.log(`🛍️ [processShopeeOrders] Processando pedidos para Shop ID: ${shop_id} (Client ID: ${client_id})`);

      let currentAccessToken = access_token;
      const expiresAt = new Date(access_token_expires_at);
      const now = new Date();

      // Verifica se o access token está expirado ou perto de expirar (ex: nos próximos 5 minutos)
      if (!currentAccessToken || now >= expiresAt || (expiresAt.getTime() - now.getTime()) < (5 * 60 * 1000)) {
        console.log(`⚠️ [processShopeeOrders] Access Token para Shop ID ${shop_id} expirado ou perto de expirar. Tentando refrescar...`);
        try {
          // A função refreshShopeeAccessToken já atualiza o banco de dados
          // e retorna o NOVO access_token.
          currentAccessToken = await refreshShopeeAccessToken(connectionId, shop_id, refresh_token);
          console.log(`✅ [processShopeeOrders] Access Token refrescado com sucesso para Shop ID ${shop_id}.`);
        } catch (refreshError) {
          console.error(`❌ [processShopeeOrders] Falha ao refrescar token para Shop ID ${shop_id}. Pulando esta conexão.`, refreshError.message);
          continue; // Pula para a próxima conexão se o refresh falhar
        }
      } else {
        console.log(`ℹ️ [processShopeeOrders] Access Token para Shop ID ${shop_id} ainda válido.`);
      }

      // Agora que temos certeza de ter um access_token válido (currentAccessToken)
      // e o shop_id numérico, podemos chamar fetchShopeeOrders
      try {
        // MUDANÇA CRÍTICA AQUI: Usando o 'currentAccessToken' e 'shop_id' diretamente
        const orders = await fetchShopeeOrders(shop_id, currentAccessToken, connectionId);
        // Implementar a lógica para processar/salvar os 'orders' obtidos se necessário.
        // A função fetchShopeeOrders já tem um placeholder para salvar no Supabase.
        console.log(`✅ [processShopeeOrders] Pedidos para Shop ID ${shop_id} processados com sucesso.`);
      } catch (fetchError) {
        console.error(`❌ [processShopeeOrders] Erro ao buscar pedidos para Shop ID ${shop_id}:`, fetchError.message);
        // Não continua para a próxima conexão, já que este erro é específico
        // do fetch de pedidos para a conexão atual.
      }
    }

    console.log('🎉 [processShopeeOrders] Processamento de pedidos Shopee concluído.');

  } catch (mainError) {
    console.error('🔥 [processShopeeOrders] Erro inesperado no fluxo principal:', mainError.message);
  }
}

module.exports = {
  processShopeeOrders,
};