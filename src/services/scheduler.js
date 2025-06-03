// src/services/scheduler.js
const { fetchShopeeOrders } = require('../api/shopee/orders');
const { processShopeeRawOrders } = require('./orderProcessor');
const { supabase } = require('../database'); // Para buscar clientes e suas conexões

// Isso é um exemplo simples. Em produção, considere libs como 'node-cron' ou serviços externos.

async function startSchedulers() {
  console.log('⏰ Iniciando agendadores...');

  // Agendar busca de pedidos da Shopee
  // Em um ambiente real, você provavelmente iteraria sobre todos os clientes
  // e suas respectivas conexões Shopee ativas.
  setInterval(async () => {
    console.log('\n--- Executando tarefa agendada: Buscar Pedidos Shopee ---');
    try {
      // Exemplo: Buscar a lista de clientes para os quais você quer buscar pedidos
      // Para simplificar, vou buscar apenas um cliente de exemplo
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .limit(1); // Ou buscar todos

      if (clientError) {
        console.error('❌ Erro ao buscar clientes para o scheduler:', clientError.message);
        return;
      }

      for (const client of clients) {
        console.log(`Buscando pedidos Shopee para o cliente: ${client.name} (ID: ${client.id})`);
        // Você precisará do shop_id para cada conexão. Isso deve estar em client_connections.additional_data.
        // Por simplicidade, vou usar um shop_id fictício aqui.
        // Em um cenário real, você buscaria a conexão shopee do cliente:
        const { data: shopeeConnection, error: connError } = await supabase
          .from('client_connections')
          .select('additional_data')
          .eq('client_id', client.id)
          .eq('connection_name', 'shopee')
          .single();

        if (connError && connError.code !== 'PGRST116') {
             console.error(`❌ Erro ao buscar conexão Shopee para o cliente ${client.id}:`, connError.message);
             continue;
        }

        if (shopeeConnection && shopeeConnection.additional_data && shopeeConnection.additional_data.shop_id) {
            const shopId = shopeeConnection.additional_data.shop_id;
            // timeFrom e timeTo para buscar incrementais
            // Você pode armazenar o último timestamp da busca em client_connections.additional_data
            const lastFetchTimestamp = shopeeConnection.additional_data.last_shopee_fetch_timestamp || 0;
            const currentTime = Math.floor(Date.now() / 1000); // Current Unix timestamp
            
            await fetchShopeeOrders(client.id, shopId, '', 20, lastFetchTimestamp, currentTime);

            // Atualizar o last_shopee_fetch_timestamp na client_connections
            await supabase
                .from('client_connections')
                .update({
                    additional_data: {
                        ...shopeeConnection.additional_data,
                        last_shopee_fetch_timestamp: currentTime
                    }
                })
                .eq('client_id', client.id)
                .eq('connection_name', 'shopee');
        } else {
            console.warn(`⚠️ Nenhuma conexão Shopee válida encontrada para o cliente ${client.id}.`);
        }
      }
    } catch (error) {
      console.error('🚨 Erro no scheduler de busca de pedidos Shopee:', error.message);
    }
    console.log('--- Fim da tarefa agendada: Buscar Pedidos Shopee ---');
  }, 3600000); // A cada 1 hora (3600000 ms)

  // Agendar processamento de pedidos brutos
  setInterval(async () => {
    console.log('\n--- Executando tarefa agendada: Processar Pedidos Brutos Shopee ---');
    try {
      await processShopeeRawOrders();
    } catch (error) {
      console.error('🚨 Erro no scheduler de processamento de pedidos brutos Shopee:', error.message);
    }
    console.log('--- Fim da tarefa agendada: Processar Pedidos Brutos Shopee ---');
  }, 300000); // A cada 5 minutos (300000 ms)
}

module.exports = {
  startSchedulers,
};