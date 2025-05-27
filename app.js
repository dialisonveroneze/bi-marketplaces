const express = require('express');
const fetchShopeeOrders = require('./src/jobs/fetchShopeeOrders');
const normalizeShopee = require('./src/jobs/normalizeShopee');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('BI Marketplaces API running!');
});

app.get('/callback', (req, res) => {
  console.log('Recebido callback:', req.query);
  res.status(200).send('Callback recebido com sucesso!');
});

// Executa as funções automaticamente na inicialização
(async () => {
  console.log('Iniciando aplicação...');
  await fetchShopeeOrders();
  await normalizeShopee();
})();

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
