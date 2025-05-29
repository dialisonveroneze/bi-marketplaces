// src/routes/shopeeCallback.js
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const pool = require('../db/connection');

const router = express.Router();

router.get('/callback', async (req, res) => {
  const { code, shop_id } = req.query;
  const clientId = 1; // fixo para este projeto

  try {
    console.log('📩 Callback recebido:', { code, shop_id });

    // 1. Buscar configurações do cliente
    const { rows } = await pool.query(
      `SELECT additional_data FROM client_connections WHERE client_id = $1 AND connection_name = 'shopee'`,
      [clientId]
    );

    if (rows.length === 0) throw new Error('Conexão Shopee não encontrada');

    const config = rows[0].additional_data;
    const env = config.env || 'test';
    const partnerData = config[env];
    const redirect = config.redirect;

    if (!partnerData?.partner_id || !partnerData?.partner_key) {
      throw new Error(`Credenciais ausentes para ambiente: ${env}`);
    }

    const partner_id = partnerData.partner_id;
    const partner_key = partnerData.partner_key;

    console.log('🔐 Configuração carregada:', { env, partner_id, redirect });

    // 2. Gerar assinatura
    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

    console.log('🧾 Base da assinatura:', baseString);
    console.log('✍️ Assinatura:', sign);

    // 3. Solicitar token
    const tokenResp = await axios.post(`https://partner.shopeemobile.com${path}`, {
      code,
      partner_id,
      shop_id,
      timestamp,
      sign
    });

    console.log('📨 Resposta da Shopee:', tokenResp.data);

    const { access_token, refresh_token } = tokenResp.data;

    if (!access_token || !refresh_token) {
      throw new Error('Tokens não retornados pela Shopee.');
    }

    // 4. Garantir additional_data como objeto JSON válido
    await pool.query(
      `UPDATE client_connections SET additional_data = COALESCE(additional_data, '{}'::jsonb) WHERE client_id = $1 AND connection_name = 'shopee'`,
      [clientId]
    );

    // 5. Atualizar banco
    await pool.query(
      `UPDATE client_connections
       SET access_token = $1,
           refresh_token = $2,
           additional_data = jsonb_set(additional_data, '{shop_id}', to_jsonb($3::text), true)
       WHERE client_id = $4 AND connection_name = 'shopee'`,
      [access_token, refresh_token, shop_id.toString(), clientId]
    );

    console.log('✅ Tokens salvos no banco para client_id:', clientId);
    res.send('Callback recebido com sucesso! Token salvo no banco.');
  } catch (err) {
    console.error('❌ Erro completo no callback:', err.response?.data || err.message || err);
    res.status(500).send('Erro ao processar callback: ' + (err.response?.data?.message || err.message));
  }
});

module.exports = router;
