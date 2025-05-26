const pool = require('../db/connection');
const axios = require('axios');
const logger = require('../utils/logger');

async function fetchShopeeOrders() {
  try {
    const { rows: connections } = await pool.query(`
      SELECT client_id, access_token, additional_data
      FROM client_connections
      WHERE connection_name = 'shopee'
    `);

    for (const conn of connections) {
      const { client_id, access_token, additional_data } = conn;
      const partner_id = additional_data.partner_id;
      const shop_id = additional_data.shop_id;

      const timestamp = Math.floor(Date.now() / 1000);

      const payload = {
        partner_id,
        shop_id,
        access_token,
        timestamp,
        order_status: "ALL"
      };

      const url = `${process.env.SHOPEE_API_BASE_URL}/order/get_order_list`;

      try {
        const response = await axios.post(url, payload);
        const orders = response.data.orders || [];

        for (const order of orders) {
          await pool.query(`
            INSERT INTO orders_raw_shopee (client_id, raw_data, order_id)
            VALUES ($1, $2, $3)
          `, [client_id, order, order.order_sn]);

          logger.info(`Inserido pedido ${order.order_sn} para client ${client_id}`);
        }

      } catch (err) {
        logger.error(`Erro na API Shopee client ${client_id}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error(`Erro geral: ${err.message}`);
  }
}

module.exports = fetchShopeeOrders;
