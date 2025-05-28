// src/routes/shopeeCallback.js
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const pool = require('../db/connection');

const router = express.Router();

router.get('/callback', async (req, res) => {
  const { code, shop_id } = req.query;
  const clientId = 1; // ajustar conforme a origem do cliente

  try {
    // 1. Buscar configurações do client_connections
    const { rows } = await pool.query(
      `SELECT additional_data FROM client_connections WHERE client_id = $1 AND connection_name = 'shopee'`,
      [clientId]
    );

    if (rows.length === 0) throw new Error('Conexão Shopee não encontrada');

    const config = rows[0].additional_data;
    const partnerData = config[config.env];
    const redirect = config.redirect;
    const partner_id = partnerData.partner_id;
    const partner_key = partnerData.partner_key;

    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}`;

    const sign = crypto.createHmac('sha256', partner_key)
      .update(baseString)
      .digest('hex');

    // 2. Chamar Shopee para obter access token
    const tokenResp = await axios.post(`https://partner.shopeemobile.com${path}`, {
      code,
      partner_id,
      shop_id,
      timestamp,
      sign
    });

    const { access_token, refresh_token } = tokenResp.data;

    // 3. Atualizar banco de dados com os tokens
    await pool.query(`
      UPDATE client_connections
      SET access_token = $1,
          refresh_token = $2,
          additional_data = jsonb_set(additional_data, '{shop_id}', to_jsonb($3::text), true)
      WHERE client_id = $4 AND connection_name = 'shopee'
    `, [access_token, refresh_token, shop_id.toString(), clientId]);

    res.send('Callback recebido com sucesso! Token salvo no banco.');
  } catch (err) {
    console.error('Erro no callback:', err.message);
    res.status(500).send('Erro ao processar callback: ' + err.message);
  }
});

module.exports = router;
