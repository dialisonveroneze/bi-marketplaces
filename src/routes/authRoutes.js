// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
// Você pode ter outros imports aqui, como o middleware de autenticação, etc.

const { fetchShopeeOrders } = require('../api/shopee/orders');
const { normalizeOrdersShopee } = require('../api/shopee/normalizeOrdersShopee'); // IMPORT DA NOVA FUNÇÃO

// Endpoint para buscar e salvar dados RAW da Shopee
router.get('/shopee/fetch-orders', async (req, res) => {
  // Lógica para obter shopId, accessToken, connectionId
  // IMPORTANTE: Essas variáveis devem ser configuradas nas variáveis de ambiente do Render!
  const shopId = process.env.SHOPEE_SHOP_ID_LIVE;
  const accessToken = process.env.SHOPEE_ACCESS_TOKEN_LIVE;
  const connectionId = 1; // client_id fixo por enquanto, conforme o débito técnico

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

// --- NOVO ENDPOINT PARA NORMALIZAÇÃO ---
// Este endpoint aciona o processo de normalização dos dados brutos
router.get('/shopee/normalize', async (req, res) => {
  // O client_id fixo que a função de normalização espera
  const fixedClientId = 1; // Mantém a consistência com o que é salvo no RAW

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