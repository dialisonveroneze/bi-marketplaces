// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();

const { fetchShopeeOrders } = require('../api/shopee/orders');
const { normalizeOrdersShopee } = require('../api/shopee/normalizeOrdersShopee');
const { getAccessTokenFromCode } = require('../api/shopee/auth'); // NOVO IMPORT

// Endpoint para buscar e salvar dados RAW da Shopee
router.get('/shopee/fetch-orders', async (req, res) => {
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

// Endpoint para normalização de pedidos (pode ser disparado manualmente)
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

// NOVO ENDPOINT: Recebe o code de autorização da Shopee e troca por access_token
router.get('/shopee/get-token-from-code', async (req, res) => {
  const { code, shop_id } = req.query; // A Shopee envia 'shop_id' (com underscore)

  if (!code || !shop_id) {
    return res.status(400).json({ error: 'Parâmetros "code" e "shop_id" são necessários na URL.' });
  }

  try {
    console.log(`[API_ROUTE] Endpoint /shopee/get-token-from-code acionado para Shop ID: ${shop_id}`);
    const tokens = await getAccessTokenFromCode(code, shop_id);
    
    // Você pode decidir salvar esses tokens no Supabase aqui, mas por agora, apenas retornamos
    res.status(200).json({
      message: 'Access Token e Refresh Token obtidos com sucesso!',
      shopId: shop_id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expire_in // Tempo de expiração em segundos
    });
  } catch (error) {
    console.error('Erro ao obter access token da Shopee:', error.message);
    res.status(500).json({ error: 'Erro ao obter access token da Shopee', details: error.message });
  }
});

module.exports = router;