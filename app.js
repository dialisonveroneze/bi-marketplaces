// app.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

// Jobs
const fetchShopee     = require('./src/jobs/fetchShopeeOrders');
const normalizeShopee = require('./src/jobs/normalizeShopee');
const fetchMeli       = require('./src/jobs/fetchMeliOrders');
const normalizeMeli   = require('./src/jobs/normalizeMeli');

const app  = express();
const PORT = process.env.PORT || 3000;

// ✅ Callback Shopee diretamente na rota raiz '/'
app.get('/', async (req, res) => {
  const { code, shop_id } = req.query;
  const partner_id = 2011476;
  const partner_key = '4e4b76515a5550644b4755494875614e416d7267696c706167634b6b424f5870';

  // Se não for callback, retorna mensagem padrão
  if (!code || !shop_id) {
    return res.send('BI Marketplaces API running!');
  }

  const path = '/api/v2/auth/token/get';
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partner_id}${path}${timestamp}`;
  const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');
  const url = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}`;

  console.log('📩 Callback recebido:', { code, shop_id });
  console.log('🌐 Endpoint usado:', url);

  try {
    const response = await axios.post(
      url,
      {
        code,
        shop_id: Number(shop_id),
        partner_id
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Token recebido com sucesso:', response.data);
    res.send('✅ Callback processado com sucesso. Veja o terminal.');
  } catch (error) {
    console.error('❌ Erro ao processar callback:', error.response?.data || error.message);
    res.status(500).send(`Erro ao processar callback: Tokens não retornados pela Shopee. Resposta: ${JSON.stringify(error.response?.data || error.message)}`);
  }
});

// IP público da instância
app.get('/my-ip', async (req, res) => {
  try {
    const resp = await axios.get('https://ifconfig.me');
    res.send(`Meu IP público é: ${resp.data}`);
  } catch (err) {
    res.status(500).send('Erro ao buscar IP: ' + err.message);
  }
});

// 🔄 Pipeline de coleta e normalização
async function runAll() {
  try {
    console.log('🕜 Iniciando ciclo de coleta e normalização:');
    console.log('› Fetch Shopee');
    await fetchShopee();
    console.log('› Fetch Mercado Livre');
    await fetchMeli();
    console.log('› Normalize Shopee');
    await normalizeShopee();
    console.log('› Normalize Mercado Livre');
    await normalizeMeli();
    console.log('✅ Ciclo concluído.');
  } catch (err) {
    console.error('❌ Erro no ciclo:', err);
  }
}

// Executa ao iniciar
runAll();

// Agenda o ciclo a cada 1 hora
const ONE_HOUR = 1000 * 60 * 60;
setInterval(runAll, ONE_HOUR);

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
