// app.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');

// Rotas
const shopeeCallback = require('./src/routes/shopeeCallback');

// Jobs
const fetchShopee     = require('./src/jobs/fetchShopeeOrders');
const normalizeShopee = require('./src/jobs/normalizeShopee');
const fetchMeli       = require('./src/jobs/fetchMeliOrders');
const normalizeMeli   = require('./src/jobs/normalizeMeli');

const app  = express();
const PORT = process.env.PORT || 3000;

// Rota para callback Shopee
app.use('/', shopeeCallback);

// Healthcheck
app.get('/', (req, res) => res.send('BI Marketplaces API running!'));

// IP público da instância
app.get('/my-ip', async (req, res) => {
  try {
    const resp = await axios.get('https://ifconfig.me');
    res.send(`Meu IP público é: ${resp.data}`);
  } catch (err) {
    res.status(500).send('Erro ao buscar IP: ' + err.message);
  }
});

// Pipeline de coleta e normalização
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
