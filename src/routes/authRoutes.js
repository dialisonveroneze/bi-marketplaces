// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto'); // Módulo de criptografia do Node.js
const { supabase } = require('../supabaseClient'); // Certifique-se de que o caminho está correto

// Rota de callback da Shopee
// Agora escuta na raiz, pois a Shopee só permite configurar o domínio na URL de redirecionamento
router.get('/', async (req, res) => {
    const { code, shop_id } = req.query;

    if (!code || !shop_id) {
        console.error('[API_ROUTE] Callback da Shopee sem code ou shop_id.');
        return res.status(400).send('Erro: Parâmetros de callback ausentes.');
    }

    console.log(`[API_ROUTE] Endpoint / acionado com code e shop_id para Shop ID: ${shop_id}`);

    const partnerId = process.env.SHOPEE_PARTNER_ID_LIVE;
    const partnerKey = process.env.SHOPEE_API_KEY_LIVE;
    const redirectUrl = process.env.SHOPEE_REDIRECT_URL_LIVE; // Agora deve ser APENAS o domínio
    const apiHost = process.env.SHOPEE_API_HOST_LIVE;

    // Validação básica para garantir que as variáveis de ambiente estão definidas
    if (!partnerId || !partnerKey || !redirectUrl || !apiHost) {
        console.error("Erro: Variáveis de ambiente da Shopee não estão configuradas corretamente.");
        return res.status(500).send("Erro de configuração do servidor.");
    }

    try {
        const path = '/api/v2/auth/token_by_code';
        const timestamp = Math.floor(Date.now() / 1000);

        // Corpo da requisição para a Shopee
        const requestBody = {
            code: code,
            shop_id: parseInt(shop_id),
            partner_id: parseInt(partnerId),
            // ATENÇÃO: redirect_url deve ser exatamente o que a Shopee espera aqui
            // Neste cenário, será apenas o domínio, pois o painel da Shopee não permite o caminho completo
            redirect_url: redirectUrl 
        };

        // String base para a assinatura da chamada token_by_code
        // Formato: partner_id + path + timestamp + JSON.stringify(requestBody)
        const baseString = `${partnerId}${path}${timestamp}${JSON.stringify(requestBody)}`;
        
        // Calcula a assinatura HMAC-SHA256
        const sign = crypto.createHmac('sha256', partnerKey)
                          .update(baseString)
                          .digest('hex');

        // Realiza a requisição para a Shopee para obter o access token
        const response = await axios.post(`${apiHost}${path}`, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Host': new URL(apiHost).host, // Garante que o Host header é apenas o domínio
                'partner_id': partnerId,
                'timestamp': timestamp,
                'sign': sign
            }
        });

        const { access_token, refresh_token, expire_in } = response.data;
        const expiryDate = new Date(Date.now() + expire_in * 1000); // Calcula a data de expiração

        // Salva os tokens no Supabase
        const { data, error } = await supabase
            .from('api_connections_shopee')
            .upsert(
                {
                    shop_id: shop_id,
                    access_token: access_token,
                    refresh_token: refresh_token,
                    token_expires_at: expiryDate.toISOString(),
                    last_updated_at: new Date().toISOString()
                },
                { onConflict: 'shop_id' } // Atualiza se o shop_id já existir
            );

        if (error) {
            console.error('Erro ao salvar tokens no Supabase:', error);
            return res.status(500).send('Erro ao salvar tokens de acesso.');
        }

        console.log("✅ [API_ROUTE] Tokens salvos/atualizados no Supabase para Shop ID:", shop_id);
        res.status(200).send('Autorização Shopee concluída com sucesso! Tokens salvos.');

    } catch (error) {
        console.error('Erro na requisição getAccessTokenFromCode:', error.response ? JSON.stringify(error.response.data) : error.message);
        console.error('❌ [API_ROUTE] Erro ao obter access token da Shopee via rota de callback: Falha ao obter access token da Shopee:', error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).send(`Erro ao obter access token da Shopee: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
});

module.exports = router;