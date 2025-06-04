// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
// ... (outros imports, como o middleware de autenticação, etc.) ...

const { fetchShopeeOrders } = require('../api/shopee/orders');
const { normalizeOrdersShopee } = require('../api/shopee/normalizeOrdersShopee'); // IMPORT DA NOVA FUNÇÃO

// Seu endpoint existente para buscar dados brutos da Shopee
router.get('/shopee/fetch-orders', async (req, res) => {
  // Lógica para obter shopId, accessToken, connectionId
  // Por agora, vamos manter o client_id fixo como 1, conforme o débito técnico.
  // Em um cenário real, você obteria esses dados de alguma conexão persistida ou do usuário logado.
  const shopId = process.env.SHOPEE_SHOP_ID_LIVE; // Exemplo, ajuste conforme sua necessidade
  const accessToken = process.env.SHOPEE_ACCESS_TOKEN_LIVE; // Exemplo, ajuste conforme sua necessidade
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

// --- NOVO ENDPOINT PARA NORMALIZAÇÃO ---
router.get('/shopee/normalize', async (req, res) => {
  // O client_id fixo que a função de normalização espera
  const fixedClientId = 1;

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