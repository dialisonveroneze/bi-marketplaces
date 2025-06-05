// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const shopeeAuthService = require('../services/shopeeAuthService');
const supabase = require('../config/supabase');
const shopeeConfig = require('../config/shopeeConfig');

// Rota para gerar o link de autorização da Shopee
router.get('/shopee/authorize', (req, res) => {
    try {
        const authLink = shopeeAuthService.generateShopeeAuthLink();
        console.log(`[AuthRoutes:/shopee/authorize] Redirecionando o usuário para: ${authLink}`);
        res.redirect(authLink);
    } catch (error) {
        console.error('❌ [AuthRoutes:/shopee/authorize] Erro ao gerar link de autorização da Shopee:', error.message);
        res.status(500).send('Erro ao gerar link de autorização da Shopee.');
    }
});

// Endpoint de Callback da Shopee
// Este é o endpoint para o qual a Shopee redireciona o usuário após a autorização,
// enviando o 'code' (código de autorização) e os IDs da loja/conta principal.
router.get('/shopee/callback', async (req, res) => {
    // Captura todos os parâmetros da query, incluindo 'error' e 'message' caso a Shopee retorne um erro
    const { code, shop_id, main_account_id, error, message } = req.query;

    console.log(`\n--- [AuthRoutes:/shopee/callback] INÍCIO DO CALLBACK ---`);
    console.log(`  Query Params Recebidos da Shopee: ${JSON.stringify(req.query)}`);

    // Verifica se a Shopee reportou um erro diretamente no callback
    if (error) {
        console.error(`❌ [AuthRoutes:/shopee/callback] Erro reportado pela Shopee no callback. Erro: ${error}, Mensagem: ${message || 'Nenhuma mensagem adicional.'}`);
        return res.status(400).json({
            error: `Erro no callback da Shopee: ${error}`,
            message: message || 'Por favor, tente novamente ou verifique as configurações da Shopee.',
            received_query: req.query // Inclui a query recebida para depuração
        });
    }

    // Verifica se os parâmetros essenciais (code e um dos IDs) estão presentes
    if (!code || (!shop_id && !main_account_id)) {
        console.error('❌ [AuthRoutes:/shopee/callback] Erro: Parâmetros essenciais ausentes (code, shop_id ou main_account_id).');
        return res.status(400).json({
            error: 'Parâmetros de callback ausentes.',
            message: 'O "code" de autorização e o ID da loja/conta principal são necessários para prosseguir.',
            received_query: req.query
        });
    }

    // Determina qual ID usar para o processo (loja ou conta principal)
    const idToProcess = shop_id || main_account_id;
    const idType = shop_id ? 'shop_id' : 'main_account_id';

    console.log(`  Processando callback para ${idType}: ${idToProcess} com code: ${code.substring(0, 5)}...`);

    try {
        // Usa o serviço para obter os tokens com base no código recebido
        const tokens = await shopeeAuthService.getAccessTokenFromCode(code, shop_id, main_account_id);

        // Calcula a data de expiração do token
        const tokenExpiresAt = new Date(Date.now() + tokens.expire_in * 1000).toISOString();

        // Prepara os dados para serem inseridos/atualizados no Supabase
        const upsertData = {
            [idType]: Number(idToProcess), // Chave dinâmica (shop_id ou main_account_id)
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: tokenExpiresAt,
            last_updated_at: new Date().toISOString(),
            partner_id: shopeeConfig.SHOPEE_PARTNER_ID_LIVE, // Salva o Partner ID configurado
        };

        // Adiciona merchant_id_list e shop_id_list se existirem na resposta da Shopee
        // Estes campos são para contas de parceiro, e podem não estar presentes para lojas individuais
        if (tokens.merchant_id_list && tokens.merchant_id_list.length > 0) {
            upsertData.merchant_id_list = tokens.merchant_id_list;
        }
        if (tokens.shop_id_list && tokens.shop_id_list.length > 0) {
            upsertData.shop_id_list = tokens.shop_id_list;
        }

        console.log(`  Dados para upsert no Supabase: ${JSON.stringify(upsertData)}`);
        console.log(`  Chave de Conflito para Upsert no Supabase: '${idType}'`);


        // Salva ou atualiza os tokens e informações no Supabase
        const { error: upsertError } = await supabase
            .from('api_connections_shopee')
            .upsert(upsertData, { onConflict: idType }); // Define a chave de conflito para upsert

        if (upsertError) {
            // Loga o erro de forma mais robusta
            const errorMessageSupabase = upsertError.message || JSON.stringify(upsertError);
            console.error('❌ [AuthRoutes:/shopee/callback] Erro ao salvar/atualizar tokens no Supabase:', errorMessageSupabase);
            return res.status(500).json({ error: 'Erro ao salvar tokens no Supabase', details: errorMessageSupabase });
        } else {
            console.log(`✅ [AuthRoutes:/shopee/callback] Tokens salvos/atualizados no Supabase para ${idType}: ${idToProcess}.`);
        }

        // Prepara a resposta de sucesso para o cliente
        const successResponse = {
            message: 'Access Token e Refresh Token obtidos e salvos no banco de dados com sucesso! Copie os valores abaixo para testes manuais.',
            [idType]: idToProcess,
            accessToken: tokens.access_token, // Exibindo para facilitar depuração
            refreshToken: tokens.refresh_token, // Exibindo para facilitar depuração
            expiresIn: tokens.expire_in,
            ...(tokens.merchant_id_list && { merchantIdList: tokens.merchant_id_list }),
            ...(tokens.shop_id_list && { shopIdList: tokens.shop_id_list })
        };
        console.log(`  Resposta de Sucesso Enviada para o Cliente: ${JSON.stringify(successResponse)}`);
        res.status(200).json(successResponse);

    } catch (error) {
        console.error('❌ [AuthRoutes:/shopee/callback] Erro no fluxo de callback da Shopee:', error.message);
        res.status(500).json({
            error: `Erro ao processar callback da Shopee: ${error.message}`,
            details: error.response ? JSON.stringify(error.response.data) : error.message, // Inclui detalhes da resposta da Shopee se houver
            received_query: req.query // Inclui a query original recebida para depuração
        });
    } finally {
        console.log(`--- [AuthRoutes:/shopee/callback] FIM DO CALLBACK ---\n`);
    }
});

module.exports = router;