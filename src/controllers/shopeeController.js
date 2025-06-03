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

    for (const connection of connections) {
      // --- REMOVENDO LOG ANTERIOR DE DEBUG DE CONEXÃO ---
      // console.log('--- DEBUG: Objeto de Conexão RAW do Supabase ---');
      // console.log(JSON.stringify(connection, null, 2));
      // console.log('-----------------------------------------------');
      // --- FIM DO LOG ANTERIOR ---

      // MUDANÇA CRÍTICA AQUI: Desestruturando connection.additional_data.shop_id
      const { id: connectionId, client_id, access_token, refresh_token, access_token_expires_at, additional_data } = connection;
      
      // Acessa o shop_id de additional_data e garante que é um número
      const shopId = Number(additional_data?.shop_id); // Usa optional chaining para segurança

      // Também é uma boa prática garantir que shopId é um número válido antes de continuar
      if (isNaN(shopId) || shopId <= 0) {
          console.error(`❌ [processShopeeOrders] Shop ID inválido encontrado na conexão ${connectionId}: ${additional_data?.shop_id}. Pulando esta conexão.`);
          continue;
      }

      console.log(`🛍️ [processShopeeOrders] Processando pedidos para Shop ID: ${shopId} (Client ID: ${client_id})`);

      let currentAccessToken = access_token;
      const expiresAt = new Date(access_token_expires_at);
      const now = new Date();

      if (!currentAccessToken || now >= expiresAt || (expiresAt.getTime() - now.getTime()) < (5 * 60 * 1000)) {
        console.log(`⚠️ [processShopeeOrders] Access Token para Shop ID ${shopId} expirado ou perto de expirar. Tentando refrescar...`);
        try {
          // Passando o shopId numérico para refreshShopeeAccessToken
          currentAccessToken = await refreshShopeeAccessToken(connectionId, shopId, refresh_token);
          console.log(`✅ [processShopeeOrders] Access Token refrescado com sucesso para Shop ID ${shopId}.`);
        } catch (refreshError) {
          console.error(`❌ [processShopeeOrders] Falha ao refrescar token para Shop ID ${shopId}. Pulando esta conexão.`, refreshError.message);
          continue;
        }
      } else {
        console.log(`ℹ️ [processShopeeOrders] Access Token para Shop ID ${shopId} ainda válido.`);
      }

      try {
        // Passando shopId numérico e currentAccessToken para fetchShopeeOrders
        const orders = await fetchShopeeOrders(shopId, currentAccessToken, connectionId);
        console.log(`✅ [processShopeeOrders] Pedidos para Shop ID ${shopId} processados com sucesso.`);
      } catch (fetchError) {
        console.error(`❌ [processShopeeOrders] Erro ao buscar pedidos para Shop ID ${shopId}:`, fetchError.message);
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