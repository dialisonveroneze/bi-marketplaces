const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const pool = require('../db/connection');

const router = express.Router();

router.get('/callback', async (req, res) => {
  const { code, shop_id } = req.query;
  const clientId = 1;

  try {
    console.log('📩 Callback recebido:', { code, shop_id });

    // 1. Buscar config do banco
    const { rows } = await pool.query(
      `SELECT additional_data FROM client_connections WHERE client_id = $1 AND connection_name = 'shopee'`,
      [clientId]
    );

    if (rows.length === 0) throw new Error('Conexão Shopee não encontrada');

    const config = rows[0].additional_data;
    const env = config.env || 'test';
    const partnerData = config[env];

    if (!partnerData?.partner_id || !partnerData?.partner_key) {
      throw new Error(`Credenciais ausentes para ambiente: ${env}`);
    }

    const partner_id = partnerData.partner_id;
    const partner_key = partnerData.partner_key;

    // 2. Gerar assinatura
    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

    const url = `https://partner.shopeemobile.com${path}`;

    console.log('🌐 Endpoint usado:', url);

    // 3. Enviar requisição POST com partner_id no BODY
    const tokenResp = await axios.post(
      url,
      {
        code,
        shop_id,
        partner_id,
        timestamp,
        sign
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📨 Resposta da Shopee:', tokenResp.data);

    const { access_token, refresh_token } = tokenResp.data;

    if (!access_token || !refresh_token) {
      throw new Error('Tokens não retornados pela Shopee. Resposta: ' + JSON.stringify(tokenResp.data));
    }

    // 4. Salvar tokens
    await pool.query(
      `UPDATE client_connections
       SET access_token = $1,
           refresh_token = $2,
           additional_data = jsonb_set(additional_data, '{shop_id}', to_jsonb($3::text), true)
       WHERE client_id = $4 AND connection_name = 'shopee'`,
      [access_token, refresh_token, shop_id.toString(), clientId]
    );

    console.log('✅ Tokens salvos para o client_id:', clientId);
    res.send('Callback recebido com sucesso. Tokens salvos.');
  } catch (err) {
    console.error('❌ Erro no callback:', err.response?.data || err.message);
    res.status(500).send('Erro ao processar callback: ' + (err.response?.data?.message || err.message));
  }
});

module.exports = router;
