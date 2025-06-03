// src/controllers/shopeeController.js
const { supabase } = require('../database');
const { fetchShopeeOrders } = require('../api/shopee/orders');
const { refreshShopeeAccessToken } = require('../api/shopee/auth');

async function processShopeeOrders() {
  console.log('🔄 [processShopeeOrders] Iniciando o processamento de pedidos Shopee...');
  try {
    const { data: connections, error } = await supabase
      .from('client_connections')
      .select('*')
      .eq('connection_name', 'shopee');

    if (error) {
      console.error('❌ [processShopeeOrders] Erro ao buscar conexões Shopee:', error.message);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('📦 [processShopeeOrders] Nenhuma conexão Shopee encontrada para processar.');
      return;
    }

    console.log(`📦 [processShopeeOrders] Encontradas ${connections.length} conexões Shopee para processar.`);

    for (const connection of connections) {
      // Acesse access_token_expires_at DIRETAMENTE do objeto 'connection'
      const { id: connectionId, client_id, access_token, refresh_token, additional_data, access_token_expires_at } = connection;

      // Extract shop_id from additional_data or ensure it's a direct column if needed
      const shop_id = additional_data?.shop_id || connection.shop_id;

      if (!shop_id) {
          console.warn(`⚠️ [processShopeeOrders] Pulando conexão ${connectionId}: Shop ID não encontrado.`);
          continue;
      }

      console.log(`🛍️ [processShopeeOrders] Processando pedidos para Shop ID: ${shop_id} (Client ID: ${client_id})`);

      let currentAccessToken = access_token;
      let shouldRefresh = false;

      // === Lógica de Refresh do Token ===
      const now = new Date();

      if (!access_token_expires_at) {
          console.warn(`⚠️ [processShopeeOrders] Data de expiração do Access Token não encontrada para Shop ID ${shop_id}. Tentando refresh...`);
          shouldRefresh = true;
      } else {
          const expiresAt = new Date(access_token_expires_at); // Converte para objeto Date
          const FIVE_MINUTES_IN_MS = 5 * 60 * 1000; // Refrescar se faltar menos de 5 minutos para expirar

          if (expiresAt.getTime() - now.getTime() < FIVE_MINUTES_IN_MS) {
              console.log(`⚠️ [processShopeeOrders] Access Token para Shop ID ${shop_id} expirado ou próximo de expirar. Tentando refresh...`);
              shouldRefresh = true;
          }
      }

      if (shouldRefresh) {
        try {
          // Passa connectionId para atualizar a linha correta em client_connections
          currentAccessToken = await refreshShopeeAccessToken(connectionId, shop_id, refresh_token);
          console.log(`✅ [processShopeeOrders] Token refreshed successfully for Shop ID ${shop_id}.`);
        } catch (refreshError) {
          console.error(`❌ [processShopeeOrders] Falha ao refrescar token para Shop ID ${shop_id}. Pulando esta conexão.`);
          continue; // Pula para a próxima conexão se o refresh falhar
        }
      }
      // ===========================

      try {
        await fetchShopeeOrders({ client_id, shop_id, access_token: currentAccessToken }); // Usa o token potencialmente refrescado
        console.log(`✅ [processShopeeOrders] Pedidos para Shop ID: ${shop_id} processados com sucesso.`);
      } catch (orderError) {
        console.error(`❌ [processShopeeOrders] Erro ao buscar pedidos para Shop ID ${shop_id}:`, orderError.message);
      }
    }
    console.log('🎉 [processShopeeOrders] Processamento de pedidos Shopee concluído.');
  } catch (globalError) {
    console.error('🔥 [processShopeeOrders] Erro inesperado durante o processamento de pedidos Shopee:', globalError.message);
  }
}

module.exports = {
  processShopeeOrders,
};