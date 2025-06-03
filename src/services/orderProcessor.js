// src/services/orderProcessor.js
const { supabase } = require('../database');

/**
 * Processa pedidos brutos da Shopee, normaliza e salva em orders_normalized.
 * Marca os pedidos brutos como processados.
 */
async function processShopeeRawOrders() {
  console.log('🔄 Iniciando processamento de pedidos brutos da Shopee...');

  try {
    // 1. Buscar pedidos brutos não processados
    const { data: rawOrders, error: fetchError } = await supabase
      .from('orders_raw_shopee')
      .select('*')
      .eq('is_processed', false)
      .limit(100); // Processar em lotes para evitar sobrecarga

    if (fetchError) {
      console.error('❌ Erro ao buscar pedidos brutos não processados:', fetchError.message);
      return;
    }

    if (rawOrders.length === 0) {
      console.log('✅ Nenhum pedido bruto da Shopee para processar.');
      return;
    }

    console.log(`📦 Encontrados ${rawOrders.length} pedidos brutos da Shopee para processar.`);

    const normalizedOrders = [];
    const processedRawOrderIds = [];

    for (const rawOrder of rawOrders) {
      try {
        // 2. Normalizar os dados do pedido
        const normalizedData = {
          client_id: rawOrder.client_id,
          connection_name: 'shopee', // Ou extraia de connection_name se houver no raw_data
          external_order_id: rawOrder.order_id,
          status: rawOrder.raw_data.order_status, // Exemplo: ajuste conforme a estrutura do raw_data
          total_amount: rawOrder.raw_data.total_amount, // Exemplo: ajuste conforme a estrutura do raw_data
          order_date: new Date(rawOrder.raw_data.create_time * 1000).toISOString(), // Shopee timestamp é em segundos
          // Adicione outros campos normalizados aqui
        };
        normalizedOrders.push(normalizedData);
        processedRawOrderIds.push(rawOrder.id);

      } catch (normalizationError) {
        console.error(`❌ Erro ao normalizar pedido ${rawOrder.id}:`, normalizationError.message);
        // Você pode querer registrar esses erros em uma tabela de logs de erros
      }
    }

    // 3. Inserir pedidos normalizados no banco de dados
    if (normalizedOrders.length > 0) {
      const { data: insertedNormalized, error: insertError } = await supabase
        .from('orders_normalized')
        .insert(normalizedOrders)
        .select();

      if (insertError) {
        console.error('❌ Erro ao inserir pedidos normalizados:', insertError.message);
        throw new Error('Erro ao inserir pedidos normalizados.');
      }
      console.log(`✅ ${insertedNormalized.length} pedidos normalizados inseridos com sucesso.`);
    }

    // 4. Marcar pedidos brutos como processados
    if (processedRawOrderIds.length > 0) {
      const { error: updateError } = await supabase
        .from('orders_raw_shopee')
        .update({ is_processed: true })
        .in('id', processedRawOrderIds);

      if (updateError) {
        console.error('❌ Erro ao marcar pedidos brutos como processados:', updateError.message);
        // Considere ter uma lógica de retry ou logs aqui, pois isso é crítico
      } else {
        console.log(`✅ ${processedRawOrderIds.length} pedidos brutos marcados como processados.`);
      }
    }

    console.log('🎉 Processamento de pedidos brutos da Shopee concluído.');

  } catch (error) {
    console.error('🚨 Erro geral no processamento de pedidos brutos da Shopee:', error.message);
  }
}

module.exports = {
  processShopeeRawOrders,
  // Adicione funções para processar pedidos do Mercado Livre aqui
};