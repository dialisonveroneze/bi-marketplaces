// src/api/shopee/normalizeOrdersShopee.js
const { supabase } = require('../../database');

/**
 * Normaliza os pedidos brutos da Shopee de 'orders_raw_shopee' para 'orders_detail_normalized'.
 * Processa apenas pedidos com is_processed = FALSE.
 *
 * @param {number} client_id O ID do cliente (client_id) para filtrar os pedidos.
 */
async function normalizeOrdersShopee(client_id) {
  console.log(`[DEBUG_NORMALIZER] Iniciando normalização para client_id: ${client_id}`);

  try {
    // 1. Buscar pedidos brutos não processados para este client_id
    const { data: rawOrders, error: fetchError } = await supabase
      .from('orders_raw_shopee')
      .select('order_id, raw_data')
      .eq('is_processed', false)
      .eq('client_id', client_id); // Filtrar pelo client_id para garantir relevância

    if (fetchError) {
      console.error('❌ [NORMALIZER] Erro ao buscar pedidos brutos não processados:', fetchError.message);
      return;
    }

    if (rawOrders.length === 0) {
      console.log('[NORMALIZER] Nenhuns pedidos brutos para normalizar.');
      return;
    }

    console.log(`[NORMALIZER] Encontrados ${rawOrders.length} pedidos brutos para normalizar.`);

    const normalizedOrdersToUpsert = rawOrders.map(rawOrder => {
      const order = rawOrder.raw_data; // O JSON completo está na coluna 'raw_data'

      // Mapeamento e transformação dos dados do JSON para a estrutura normalizada
      return {
        order_id: order.order_sn,
        client_id: client_id,
        order_status: order.order_status,

        // Conversão de timestamps Unix (segundos) para o formato ISO 8601 que o PostgreSQL espera
        create_time_utc: order.create_time ? new Date(order.create_time * 1000).toISOString() : null,
        update_time_utc: order.update_time ? new Date(order.update_time * 1000).toISOString() : null,
        pay_time_utc: order.payment_info && order.payment_info.pay_time ? new Date(order.payment_info.pay_time * 1000).toISOString() : null,

        total_amount: order.total_amount,
        shipping_fee: order.shipping_fee,
        actual_shipping_fee: order.actual_shipping_fee,
        payment_method: order.payment_info ? order.payment_info.payment_method : null,
        paid_amount: order.payment_info ? order.payment_info.paid_amount : null,
        currency: order.currency,

        // Campos do Endereço (recipient_address)
        recipient_name: order.recipient_address ? order.recipient_address.name : null,
        recipient_phone: order.recipient_address ? order.recipient_address.phone : null,
        recipient_full_address: order.recipient_address ? order.recipient_address.full_address : null,
        recipient_city: order.recipient_address ? order.recipient_address.city : null,
        recipient_state: order.recipient_address ? order.recipient_address.state : null,
        recipient_zipcode: order.recipient_address ? order.recipient_address.zipcode : null,
        recipient_country: order.recipient_address ? order.recipient_address.country : null,

        raw_data_id: order.order_sn, // Link para o registro em orders_raw_shopee
      };
    });

    // 2. Fazer upsert na tabela orders_detail_normalized
    console.log(`[NORMALIZER] Preparando ${normalizedOrdersToUpsert.length} pedidos para upsert em orders_detail_normalized.`);
    const { error: upsertError } = await supabase
      .from('orders_detail_normalized')
      .upsert(normalizedOrdersToUpsert, {
        onConflict: ['order_id'], // Usa order_id para conflito (upsert)
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error('❌ [NORMALIZER] Erro ao salvar dados normalizados:', upsertError.message);
      // Não retorna para que a atualização de is_processed possa tentar ocorrer
    } else {
      console.log(`✅ [NORMALIZER] ${normalizedOrdersToUpsert.length} pedidos normalizados salvos/atualizados em orders_detail_normalized.`);
    }

    // 3. Atualizar is_processed para TRUE em orders_raw_shopee
    // Só marcamos como processado se o upsert na tabela normalizada foi bem-sucedido
    if (!upsertError) {
        const processedOrderIds = normalizedOrdersToUpsert.map(order => order.order_id);
        const { error: updateError } = await supabase
            .from('orders_raw_shopee')
            .update({ is_processed: true })
            .in('order_id', processedOrderIds);

        if (updateError) {
            console.error('⚠️ [NORMALIZER] Erro ao atualizar is_processed em orders_raw_shopee:', updateError.message);
        } else {
            console.log(`✅ [NORMALIZER] ${processedOrderIds.length} registros em orders_raw_shopee marcados como processados.`);
        }
    }

  } catch (error) {
    console.error('❌ [NORMALIZER] Erro geral no processo de normalização:', error.message);
  }
}

module.exports = {
  normalizeOrdersShopee,
};