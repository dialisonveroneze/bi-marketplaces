// app.js
require('dotenv').config();
const express         = require('express');
const axios           = require('axios');
const fetchShopee     = require('./src/jobs/fetchShopeeOrders');
const normalizeShopee = require('./src/jobs/normalizeShopee');
const fetchMeli       = require('./src/jobs/fetchMeliOrders');
const normalizeMeli   = require('./src/jobs/normalizeMeli');

const app  = express();
const PORT = process.env.PORT || 3000;

// Healthcheck
app.get('/', (req, res) => res.send('BI Marketplaces API running!'));

// Shopee OAuth callback
app.get('/callback', (req, res) => {
  console.log('Recebido callback Shopee:', req.query);
  res.send('Callback recebido com sucesso!');
});

// Rota auxiliar para descobrir seu IP público
app.get('/my-ip', async (req, res) => {
  try {
    const resp = await axios.get('https://ifconfig.me');
    res.send(`Meu IP público é: ${resp.data}`);
  } catch (err) {
    res.status(500).send('Erro ao buscar IP: ' + err.message);
  }
});

// Função que executa todo o pipeline de coleta e normalização
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

// 1) Executa imediatamente ao subir
runAll();

// 2) Agenda para rodar a cada 1 hora (3600000 ms)
const ONE_HOUR = 1000 * 60 * 60;
setInterval(runAll, ONE_HOUR);

// Inicia o servidor HTTP
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
