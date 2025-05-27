const pool = require('../db/connection');
const axios = require('axios');

async function fetchMeliOrders() {
  try {
    // 1) Busca credenciais da conexão “meli”
    const { rows: conns } = await pool.query(`
      SELECT client_id, access_token, additional_data
      FROM client_connections
      WHERE connection_name = 'meli'
    `);

    for (const { client_id, access_token, additional_data } of conns) {
      const { app_id, app_secret } = additional_data;
      // 2) Monta URL de listagem de pedidos (exemplo genérico)
      const url = `https://api.mercadolibre.com/orders/search?seller=${app_id}&access_token=${access_token}`;
      const { data } = await axios.get(url);
      const orders = data.results || [];

      // 3) Insere cada pedido em orders_raw_meli
      for (const o of orders) {
        await pool.query(`
          INSERT INTO orders_raw_meli (client_id, raw_data, order_id)
          VALUES ($1, $2, $3)
        `, [ client_id, o, o.id ]);
      }
      console.log(`▶️  ${orders.length} pedidos Meli inseridos p/ client ${client_id}`);
    }
  } catch (err) {
    console.error('⚠️ Erro em fetchMeliOrders:', err);
  }
}

module.exports = fetchMeliOrders;
