// src/database/index.js
const { createClient } = require('@supabase/supabase-js');

// Variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Inicializa o cliente Supabase
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Insere um novo pedido bruto da Shopee no banco de dados.
 * @param {Object} data - Dados do pedido bruto.
 * @returns {Promise<Object>} - O resultado da inserção.
 */
async function insertShopeeRawOrder(data) {
  const { data: insertedData, error } = await supabase
    .from('orders_raw_shopee')
    .insert(data)
    .select(); // Adiciona .select() para retornar os dados inseridos

  if (error) {
    console.error('❌ Erro ao inserir pedido bruto da Shopee:', error.message);
    throw new Error('Erro ao inserir pedido bruto da Shopee.');
  }
  console.log('✅ Pedido bruto da Shopee inserido com sucesso:', insertedData);
  return insertedData;
}

/**
 * Insere ou atualiza informações de conexão do cliente.
 * @param {Object} connectionData - Dados da conexão (client_id, connection_name, access_token, refresh_token, etc.).
 * @returns {Promise<Object>} - O resultado da inserção/atualização.
 */
async function upsertClientConnection(connectionData) {
  // Exemplo de como você pode buscar uma conexão existente e atualizá-la,
  // ou inserir uma nova se não existir.
  // Adapte a lógica de busca/atualização conforme sua necessidade (e.g., pelo client_id e connection_name)

  const { data: existingConnection, error: fetchError } = await supabase
    .from('client_connections')
    .select('*')
    .eq('client_id', connectionData.client_id)
    .eq('connection_name', connectionData.connection_name)
    .limit(1);

  if (fetchError) {
    console.error('❌ Erro ao buscar conexão existente:', fetchError.message);
    throw new Error('Erro ao buscar conexão existente.');
  }

  let result;
  if (existingConnection && existingConnection.length > 0) {
    // Atualizar conexão existente
    const { data, error } = await supabase
      .from('client_connections')
      .update(connectionData)
      .eq('id', existingConnection[0].id)
      .select();

    if (error) {
      console.error('❌ Erro ao atualizar conexão do cliente:', error.message);
      throw new Error('Erro ao atualizar conexão do cliente.');
    }
    result = data;
    console.log('✅ Conexão do cliente atualizada com sucesso:', result);
  } else {
    // Inserir nova conexão
    const { data, error } = await supabase
      .from('client_connections')
      .insert(connectionData)
      .select();

    if (error) {
      console.error('❌ Erro ao inserir nova conexão do cliente:', error.message);
      throw new Error('Erro ao inserir nova conexão do cliente.');
    }
    result = data;
    console.log('✅ Nova conexão do cliente inserida com sucesso:', result);
  }
  return result;
}

/**
 * Obtém a conexão de um cliente específica.
 * @param {number} clientId - ID do cliente.
 * @param {string} connectionName - Nome da conexão (e.g., 'shopee').
 * @returns {Promise<Object|null>} - A conexão encontrada ou null.
 */
async function getClientConnection(clientId, connectionName) {
  // CORREÇÃO: Usar '=' para desestruturação, não '=>'
  const { data, error } = await supabase
    .from('client_connections')
    .select('*')
    .eq('client_id', clientId)
    .eq('connection_name', connectionName)
    .single(); // Use .single() se espera apenas um resultado

  if (error && error.code !== 'PGRST116') { // PGRST116 é "no rows found"
    console.error('❌ Erro ao buscar conexão do cliente:', error.message);
    throw new Error('Erro ao buscar conexão do cliente.');
  }
  return data;
}

module.exports = {
  supabase, // Você pode exportar o cliente supabase diretamente se precisar
  insertShopeeRawOrder,
  upsertClientConnection,
  getClientConnection,
  // Adicione outras funções de DB aqui (e.g., para MELI, orders_normalized)
};