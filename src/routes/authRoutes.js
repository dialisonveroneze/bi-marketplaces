// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const shopeeAuthService = require('../services/shopeeAuthService');
const supabase = require('../config/supabase');
const shopeeConfig = require('../config/shopeeConfig'); // Importa a configuração para usar o partner_id

// Rota para gerar o link de autorização (pode ser chamada por um botão no frontend)
router.get('/shopee/authorize', (req, res) => {
    try {
        const authLink = shopeeAuthService.generateShopeeAuthLink();
        res.redirect(authLink);
    } catch (error) {
        console.error('Erro ao gerar link de autorização da Shopee:', error.message);
        res.status(500).send('Erro ao gerar link de autorização da Shopee.');
    }
});

// Endpoint de Callback da Shopee - Onde a Shopee redireciona APÓS a autorização
router.get('/shopee/callback', async (req, res) => {
    const { code, shop_id, main_account_id } = req.query;

    if (!code || (!shop_id && !main_account_id)) {
        return res.status(400).send('Erro: Parâmetros de callback ausentes (code, shop_id ou main_account_id).');
    }

    const idToProcess = shop_id || main_account_id;
    const idType = shop_id ? 'shop_id' : 'main_account_id';

    try {
        const tokens = await shopeeAuthService.getAccessTokenFromCode(code, shop_id, main_account_id);

        const { error: upsertError } = await supabase
            .from('api_connections_shopee')
            .upsert(
                {
                    [idType]: Number(idToProcess),
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: new Date(Date.now() + tokens.expire_in * 1000).toISOString(),
                    last_updated_at: new Date().toISOString(),
                    partner_id: shopeeConfig.SHOPEE_PARTNER_ID_LIVE, // Usar o partner_id do config
                    ...(tokens.merchant_id_list && { merchant_id_list: tokens.merchant_id_list }),
                    ...(tokens.shop_id_list && { shop_id_list: tokens.shop_id_list })
                },
                { onConflict: idType }
            );

        if (upsertError) {
            console.error('❌ [API_ROUTE] Erro ao salvar tokens no Supabase:', upsertError.message);
            return res.status(500).json({ error: 'Erro ao salvar tokens no Supabase', details: upsertError.message });
        }

        res.status(200).json({
            message: 'Access Token e Refresh Token obtidos e salvos no banco de dados com sucesso!',
            [idType]: idToProcess,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expire_in,
        });

    } catch (error) {
        console.error('Erro no fluxo de callback da Shopee:', error.message);
        res.status(500).send(`Erro ao obter access token da Shopee: ${error.message}`);
    }
});

module.exports = router;