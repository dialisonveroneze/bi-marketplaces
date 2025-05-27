// app.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fetchShopeeOrders = require('./src/jobs/fetchShopeeOrders');
const normalizeShopee = require('./src/jobs/normalizeShopee');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('BI Marketplaces API running!'));

app.get('/callback', (req, res) => {
  console.log('Recebido callback:', req.query);
  res.send('Callback recebido com sucesso!');
});

app.get('/my-ip', async (req, res) => {
  try {
    const resp = await axios.get('https://ifconfig.me');
    res.send(`Meu IP público é: ${resp.data}`);
  } catch (err) {
    res.status(500).send('Erro ao buscar IP: ' + err.message);
  }
});

// dispara a coleta/normalização na inicialização
(async () => {
  console.log('Iniciando aplicação...');
  await fetchShopeeOrders();
  await normalizeShopee();
})();

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
