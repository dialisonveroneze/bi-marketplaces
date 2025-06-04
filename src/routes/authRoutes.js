// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
// Você pode ter outros imports aqui, como o middleware de autenticação, etc.

const { fetchShopeeOrders } = require('../api/shopee/orders');
const { normalizeOrdersShopee } = require('../api/shopee/normalizeOrdersShopee');

// Endpoint para buscar e salvar dados RAW da Shopee
router.get('/shopee/fetch-orders', async (req, res) => {
  // --- ALTERAÇÃO AQUI: Obter shopId e accessToken da query string da URL ---
  const { shopId, accessToken } = req.query; // Pega da URL: /fetch-orders?shopId=SEU_SHOP_ID&accessToken=SEU_ACCESS_TOKEN
  const connectionId = 1; // client_id fixo por enquanto

  if (!shopId || !accessToken) {
    return res.status(400).json({ error: 'Shop ID e Access Token são necessários.' });
  }

  try {
    const orders = await fetchShopeeOrders(shopId, accessToken, connectionId);
    res.status(200).json({ message: 'Pedidos Shopee buscados e salvos (RAW DATA) com sucesso.', orders_count: orders.length });
  } catch (error) {
    console.error('Erro ao buscar e salvar pedidos Shopee:', error.message);
    res.status(500).json({ error: 'Erro ao buscar e salvar pedidos Shopee', details: error.message });
  }
});

// NOVO ENDPOINT PARA NORMALIZAÇÃO
router.get('/shopee/normalize', async (req, res) => {
  const fixedClientId = 1; // client_id fixo para a normalização

  try {
    console.log(`[API_ROUTE] Endpoint /shopee/normalize acionado.`);
    await normalizeOrdersShopee(fixedClientId); // Chama a função de normalização
    res.status(200).json({ message: 'Processo de normalização de pedidos Shopee iniciado.' });
  } catch (error) {
    console.error('Erro durante o processo de normalização:', error.message);
    res.status(500).json({ error: 'Erro ao normalizar pedidos Shopee', details: error.message });
  }
});

module.exports = router;