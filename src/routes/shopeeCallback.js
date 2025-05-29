// src/routes/shopeeCallback.js
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const pool = require('../db/connection');

const router = express.Router();

router.get('/callback', async (req, res) => {
  const { code, shop_id } = req.query;
  const clientId = 1; // Fixo para esse projeto

  try {
    console.log('📩 Callback recebido:', { code, shop_id });

    // 1. Buscar configurações do cliente no banco
    const { rows } = await pool.query(
      `SELECT additional_data FROM client_connections WHERE client_id = $1 AND connection_name = 'shopee'`,
      [clientId]
    );

    if (rows.length === 0) throw new Error('Conexão Shopee não encontrada no banco');

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

    // 2. Gerar assinatura da requisição
    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

    console.log('🧾 Base da assinatura:', baseString);
    console.log('✍️ Assinatura gerada:', sign);

    // 3. Requisição à Shopee para obter os tokens
   const tokenResp = await axios.post(
  `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}`,
  {
	code,
	partner_id,
	shop_id
  },
  {
	headers: {
	  'Content-Type': 'application/json'
	}
  }
  );

    // 🔍 LOGAR a resposta completa da Shopee para análise
    console.log('📨 RESPOSTA RAW Shopee:', JSON.stringify(tokenResp.data, null, 2));

    const { access_token, refresh_token } = tokenResp.data;

    if (!access_token || !refresh_token) {
      throw new Error(
        'Tokens não retornados pela Shopee. Resposta recebida: ' +
        JSON.stringify(tokenResp.data)
      );
    }

    // 4. Garante que o campo additional_data esteja inicializado
    await pool.query(
      `UPDATE client_connections
       SET additional_data = COALESCE(additional_data, '{}'::jsonb)
       WHERE client_id = $1 AND connection_name = 'shopee'`,
      [clientId]
    );

    // 5. Salvar tokens e shop_id no banco de dados
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
    const detailedError = err.response?.data || err.message || err;
    console.error('❌ Erro completo no callback:', detailedError);
    res
      .status(500)
      .send(
        'Erro ao processar callback: ' +
          (err.response?.data?.message || err.message || 'Erro desconhecido.')
      );
  }
});

module.exports = router;
