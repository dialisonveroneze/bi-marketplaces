const pool = require('../db/connection');

async function normalizeShopee() {
  console.log('Normalizando pedidos Shopee...');

  const result = await pool.query(`
    SELECT id, client_id, raw_data
    FROM orders_raw_shopee
    WHERE is_processed = false
    LIMIT 10
  `);

  for (const row of result.rows) {
    const raw = row.raw_data;
    const clientId = row.client_id;
    const orderId = raw.order_sn || raw.order_id;

    await pool.query(`
      INSERT INTO orders_normalized (client_id, connection_name, external_order_id, status, total_amount)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      clientId,
      'shopee',
      orderId,
      raw.status || 'unknown',
      parseFloat(raw.total_amount || 0)
    ]);

    await pool.query(`
      UPDATE orders_raw_shopee SET is_processed = true WHERE id = $1
    `, [row.id]);
  }

  console.log('Normalização Shopee finalizada.');
}

module.exports = normalizeShopee;
