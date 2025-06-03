// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { generateAuthUrl, getAccessToken } = require('../api/shopee/auth');
// Importação CORRETA: O 'processShopeeOrders' está em '../controllers/shopeeController'
const { processShopeeOrders } = require('../controllers/shopeeController');

// Rota para iniciar o processo de autenticação da Shopee
router.get('/shopee', (req, res) => {
  const authUrl = generateAuthUrl();
  console.log('Redirecting to Shopee for authorization:', authUrl);
  res.redirect(authUrl);
});

// Rota de callback da Shopee após a autorização
router.get('/shopee/callback', async (req, res) => {
  const { code, shop_id } = req.query; // Ou main_account_id
  const clientId = 1; // Substitua pelo ID do cliente real que você quer associar a essa conexão
                      // Em um cenário real, você teria uma forma de identificar o cliente
                      // (e.g., via session, um parâmetro adicional na URL de auth gerada, etc.)

  if (!code || (!shop_id && !req.query.main_account_id)) {
    console.error('❌ Callback da Shopee: Código ou Shop ID/Main Account ID ausente.');
    return res.status(400).send('Erro na autenticação Shopee: Parâmetros ausentes.');
  }

  try {
    const tokens = await getAccessToken(code, shop_id || req.query.main_account_id, clientId);
    console.log('🎉 Autenticação Shopee concluída e tokens salvos:', tokens);
    res.status(200).send(`Autenticação Shopee para loja ${shop_id} concluída com sucesso! Tokens recebidos e salvos.`);
  } catch (error) {
    console.error('❌ Erro no callback de autenticação Shopee:', error.message);
    res.status(500).send(`Erro ao processar autenticação Shopee: ${error.message}`);
  }
});

// Rota de teste TEMPORÁRIA para disparar a busca de pedidos
router.get('/shopee/fetch-orders', async (req, res) => {
  console.log('🔥 Requisição para /auth/shopee/fetch-orders recebida!');
  try {
    await processShopeeOrders();
    res.status(200).send('Processamento de pedidos Shopee iniciado. Verifique os logs do Render para detalhes.');
  } catch (error) {
    console.error('❌ Erro ao iniciar processamento de pedidos Shopee:', error);
    res.status(500).send('Erro ao iniciar processamento de pedidos Shopee. Verifique os logs.');
  }
});

module.exports = router; // Apenas uma vez, no final do arquivo