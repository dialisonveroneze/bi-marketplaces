const pool = require('../db/connection');

async function normalizeMeli() {
  console.log('🔄 Normalizando pedidos Meli...');
  const { rows } = await pool.query(`
    SELECT id, raw_data, client_id
    FROM orders_raw_meli
    WHERE is_processed = false
    LIMIT 10
  `);

  for (const { id, raw_data, client_id } of rows) {
    await pool.query(`
      INSERT INTO orders_normalized
        (client_id, connection_name, external_order_id, status, total_amount)
      VALUES ($1, 'meli', $2, $3, $4)
    `, [
      client_id,
      raw_data.id,
      raw_data.status,
      parseFloat(raw_data.total_amount || 0)
    ]);

    await pool.query(`
      UPDATE orders_raw_meli
      SET is_processed = true
      WHERE id = $1
    `, [ id ]);
  }
  console.log('✅ Normalização Meli concluída.');
}

module.exports = normalizeMeli;
