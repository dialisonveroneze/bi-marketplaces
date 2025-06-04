// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js'); // Importar Supabase

const { fetchShopeeOrders } = require('../api/shopee/orders');
const { normalizeOrdersShopee } = require('../api/shopee/normalizeOrdersShopee');
const { getAccessTokenFromCode } = require('../api/shopee/auth');

// Configuração do Supabase (garanta que estas variáveis de ambiente estão no Render)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// NOVO ENDPOINT DE CALLBACK DA SHOPEE - RECEBE O CODE NA ROTA RAIZ '/'
router.get('/', async (req, res) => {
    const { code, shop_id } = req.query; // A Shopee enviará 'code' e 'shop_id' para a rota raiz

    if (code && shop_id) {
        console.log(`[API_ROUTE] Endpoint RAIZ acionado com code e shop_id para Shop ID: ${shop_id}`);
        try {
            const tokens = await getAccessTokenFromCode(code, shop_id);

            // === NOVO: SALVAR OS TOKENS NO SUPABASE ===
            const { data, error: upsertError } = await supabase
                .from('api_connections_shopee')
                .upsert({
                    connection_id: 1, // Mantendo 1 como fixo por enquanto para o client_id
                    shop_id: Number(shop_id), // Converte para número
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expires_at: new Date(Date.now() + tokens.expire_in * 1000).toISOString(), // Calcula o tempo de expiração
                    partner_id: process.env.SHOPEE_PARTNER_ID_LIVE // Salva o partner_id também
                }, { onConflict: 'shop_id' }); // Atualiza se a shop_id já existir

            if (upsertError) {
                console.error('❌ [API_ROUTE] Erro ao salvar tokens no Supabase:', upsertError.message);
                // Não lançar erro aqui para ainda mostrar os tokens na tela
            } else {
                console.log(`✅ [API_ROUTE] Tokens salvos/atualizados no Supabase para Shop ID: ${shop_id}.`);
            }
            // ===========================================

            res.status(200).json({
                message: 'Access Token e Refresh Token obtidos e salvos no banco de dados com sucesso! Copie os valores abaixo para testes manuais.',
                shopId: shop_id,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresIn: tokens.expire_in // Tempo de expiração em segundos
            });
        } catch (error) {
            console.error('❌ [API_ROUTE] Erro ao obter access token da Shopee via rota raiz:', error.message);
            res.status(500).json({ error: 'Erro ao obter access token da Shopee', details: error.message });
        }
    } else {
        // Se não houver code e shop_id, é apenas o acesso normal à raiz
        res.status(200).send('Servidor BI Marketplace Integrator rodando!');
    }
});

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

module.exports = router;