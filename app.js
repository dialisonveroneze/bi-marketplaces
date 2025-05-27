onst express = require('express');
const crypto = require('crypto');
const pool = require('./src/db/connection');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/shopee/auth-link/:client_id', async (req, res) => {
  const { client_id } = req.params;

  try {
    const { rows } = await pool.query(`
      SELECT additional_data
      FROM client_connections
      WHERE client_id = $1 AND connection_name = 'shopee'
    `, [client_id]);

    if (rows.length === 0) return res.status(404).send('Client not found');

    const { partner_id, partner_key, redirect } = rows[0].additional_data;
    const path = '/api/v2/shop/auth_partner';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}`;

    const sign = crypto.createHmac('sha256', partner_key)
                       .update(baseString)
                       .digest('hex');

    const authUrl = `https://partner.test-stable.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirect)}`;

    res.json({ authUrl });

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});