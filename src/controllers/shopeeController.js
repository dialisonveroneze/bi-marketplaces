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
      .select('*') // Garante que todas as colunas estão sendo selecionadas
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
      // --- NOVO LOG CRÍTICO AQUI ---
      console.log('--- DEBUG: Objeto de Conexão RAW do Supabase ---');
      console.log(JSON.stringify(connection, null, 2));
      console.log('-----------------------------------------------');
      // --- FIM DO NOVO LOG CRÍTICO ---

      // Verifique o log acima para confirmar os nomes corretos das colunas
      const { id: connectionId, client_id, shop_id, access_token, refresh_token, access_token_expires_at } = connection;
      
      // O 'shop_id' é crucial e deve ser um número. Se o log acima mostrar que a coluna tem outro nome (ex: 'shopee_shop_id'),
      // ou que está como string, ajuste a desestruturação e a conversão aqui.
      // Exemplo de ajuste:
      // const actualShopId = Number(connection.shopee_shop_id); // Se a coluna for 'shopee_shop_id'
      // const actualShopId = Number(shop_id); // Garante que é um número, mesmo se já for chamado 'shop_id' mas vier como string

      console.log(`🛍️ [processShopeeOrders] Processando pedidos para Shop ID: ${shop_id} (Client ID: ${client_id})`);

      let currentAccessToken = access_token;
      const expiresAt = new Date(access_token_expires_at);
      const now = new Date();

      // Verifica se o access token está expirado ou perto de expirar (ex: nos próximos 5 minutos)
      if (!currentAccessToken || now >= expiresAt || (expiresAt.getTime() - now.getTime()) < (5 * 60 * 1000)) {
        console.log(`⚠️ [processShopeeOrders] Access Token para Shop ID ${shop_id} expirado ou perto de expirar. Tentando refrescar...`);
        try {
          currentAccessToken = await refreshShopeeAccessToken(connectionId, shop_id, refresh_token);
          console.log(`✅ [processShopeeOrders] Access Token refrescado com sucesso para Shop ID ${shop_id}.`);
        } catch (refreshError) {
          console.error(`❌ [processShopeeOrders] Falha ao refrescar token para Shop ID ${shop_id}. Pulando esta conexão.`, refreshError.message);
          continue;
        }
      } else {
        console.log(`ℹ️ [processShopeeOrders] Access Token para Shop ID ${shop_id} ainda válido.`);
      }

      try {
        // Passando shop_id e currentAccessToken para fetchShopeeOrders
        // Certifique-se que shop_id aqui é o valor numérico correto.
        const orders = await fetchShopeeOrders(shop_id, currentAccessToken, connectionId);
        console.log(`✅ [processShopeeOrders] Pedidos para Shop ID ${shop_id} processados com sucesso.`);
      } catch (fetchError) {
        console.error(`❌ [processShopeeOrders] Erro ao buscar pedidos para Shop ID ${shop_id}:`, fetchError.message);
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