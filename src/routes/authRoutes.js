// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();

const { fetchShopeeOrders } = require('../api/shopee/orders');
const { normalizeOrdersShopee } = require('../api/shopee/normalizeOrdersShopee');
const { getAccessTokenFromCode } = require('../api/shopee/auth');

// =====================================================================
// NOVO ENDPOINT DE CALLBACK DA SHOPEE - RECEBE O CODE NA ROTA RAIZ '/'
// =====================================================================
router.get('/', async (req, res) => {
    const { code, shop_id } = req.query; // A Shopee enviará 'code' e 'shop_id' para a rota raiz

    if (code && shop_id) {
        console.log(`[API_ROUTE] Endpoint RAIZ acionado com code e shop_id para Shop ID: ${shop_id}`);
        try {
            const tokens = await getAccessTokenFromCode(code, shop_id);
            // Você pode decidir salvar esses tokens no Supabase aqui para persistência
            // Exemplo de como salvar (requer Supabase configurado):
            /*
            const { data, error } = await supabase.from('api_connections_shopee').upsert({
                shop_id: shop_id,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_in: tokens.expire_in, // tempo de expiração em segundos
                // Adicione outros campos como partner_id, partner_key, etc., se necessário
            }, { onConflict: 'shop_id' }); // Atualiza se a shop_id já existir

            if (error) {
                console.error('Erro ao salvar tokens no Supabase:', error.message);
            } else {
                console.log('Tokens salvos no Supabase:', data);
            }
            */

            res.status(200).json({
                message: 'Access Token e Refresh Token obtidos com sucesso! Copie os valores abaixo.',
                shopId: shop_id,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresIn: tokens.expire_in // Tempo de expiração em segundos
            });
        } catch (error) {
            console.error('Erro ao obter access token da Shopee via rota raiz:', error.message);
            res.status(500).json({ error: 'Erro ao obter access token da Shopee', details: error.message });
        }
    } else {
        // Se não houver code e shop_id, é apenas o acesso normal à raiz
        res.status(200).send('Servidor BI Marketplace Integrator rodando!');
    }
});
// =====================================================================

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

// Endpoint AGORA INATIVO/REMOVIDO, pois o '/' vai lidar com o code
// router.get('/shopee/get-token-from-code', async (req, res) => {
//   // Removido ou tornado inativo, pois a rota '/' agora fará isso
//   res.status(404).json({ error: 'Este endpoint foi movido para a rota raiz.' });
// });

module.exports = router;