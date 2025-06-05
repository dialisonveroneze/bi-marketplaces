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
router.get('/shopee/callback', async (req, res) => {
    const { code, shop_id, main_account_id, error, message } = req.query;

    console.log(`\n--- [AuthRoutes:/shopee/callback] INÍCIO DO CALLBACK ---`);
    console.log(`  Query Params Recebidos da Shopee: ${JSON.stringify(req.query)}`);

    if (error) {
        console.error(`❌ [AuthRoutes:/shopee/callback] Erro reportado pela Shopee no callback. Erro: ${error}, Mensagem: ${message || 'Nenhuma mensagem adicional.'}`);
        return res.status(400).json({
            error: `Erro no callback da Shopee: ${error}`,
            message: message || 'Por favor, tente novamente ou verifique as configurações da Shopee.',
            received_query: req.query
        });
    }

    if (!code || (!shop_id && !main_account_id)) {
        console.error('❌ [AuthRoutes:/shopee/callback] Erro: Parâmetros essenciais ausentes (code, shop_id ou main_account_id).');
        return res.status(400).json({
            error: 'Parâmetros de callback ausentes.',
            message: 'O "code" de autorização e o ID da loja/conta principal são necessários para prosseguir.',
            received_query: req.query
        });
    }

    const idToProcess = shop_id || main_account_id;
    const idType = shop_id ? 'shop_id' : 'main_account_id'; // 'shop_id' é a chave de conflito para upsert

    console.log(`  Processando callback para ${idType}: ${idToProcess} com code: ${code.substring(0, 5)}...`);

    try {
        const tokens = await shopeeAuthService.getAccessTokenFromCode(code, shop_id, main_account_id);
        const tokenExpiresAt = new Date(Date.now() + tokens.expire_in * 1000).toISOString();

        // Mapeia os dados da Shopee para o schema da tabela `client_connections`
        const upsertData = {
            client_id: Number(idToProcess), // Mapeia shop_id para client_id, que é a PK ou UNIQUE
            connection_name: `Shopee Shop ${idToProcess}`, // Exemplo: um nome para a conexão
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            access_token_expires_at: tokenExpiresAt, // Mapeia para access_token_expires_at
            updated_at: new Date().toISOString(), // Mapeia para updated_at
            // Você pode adicionar mais dados no 'additional_data' se precisar
            additional_data: {
                partner_id: shopeeConfig.SHOPEE_PARTNER_ID_LIVE,
                original_shop_id_shopee: idToProcess, // Guarda o shop_id original da Shopee
                // Adicione merchant_id_list e shop_id_list aqui se aplicável
                ...(tokens.merchant_id_list && { merchant_id_list: tokens.merchant_id_list }),
                ...(tokens.shop_id_list && { shop_id_list: tokens.shop_id_list })
            }
        };

        // Verifica se é uma inserção (se o 'id' não existir) e gera um novo 'id' se necessário
        // (Apenas se 'id' for SERIAL/IDENTITY. Se for gerado automaticamente pelo DB, não precisa).
        // Se 'id' for auto-incrementado, não inclua ele no upsertData inicial.
        // Se você usa 'client_id' como PK/UNIQUE, o 'id' auto-incrementado é secundário.
        // Pelo seu schema, 'id' é `number` e `integer`, e `client_id` é `OptionalType number`,
        // mas é o `client_id` que faz sentido para o `onConflict`.
        // Vamos presumir que `client_id` é a chave única para upsert.

        console.log(`  Dados para upsert na tabela 'client_connections': ${JSON.stringify(upsertData)}`);
        console.log(`  Chave de Conflito para Upsert no Supabase: 'client_id'`); // Usamos client_id como chave de conflito

        // Salva ou atualiza os tokens e informações no Supabase na tabela CORRETA
        const { data: upsertedData, error: upsertError } = await supabase
            .from('client_connections') // <-- NOME DA TABELA CORRIGIDO!
            .upsert(upsertData, { onConflict: 'client_id' }) // Chave de conflito deve ser 'client_id'
            .select(); // Adicione .select() para retornar os dados inseridos/atualizados

        if (upsertError) {
            const errorMessageSupabase = upsertError.message || JSON.IFY(upsertError);
            console.error('❌ [AuthRoutes:/shopee/callback] Erro ao salvar/atualizar tokens no Supabase:', errorMessageSupabase);
            return res.status(500).json({ error: 'Erro ao salvar tokens no Supabase', details: errorMessageSupabase });
        } else {
            console.log(`✅ [AuthRoutes:/shopee/callback] Tokens salvos/atualizados no Supabase para ${idType}: ${idToProcess}.`);
            console.log(`  Dados retornados pelo upsert: ${JSON.stringify(upsertedData)}`);
        }

        const successResponse = {
            message: 'Access Token e Refresh Token obtidos e salvos no banco de dados com sucesso! Copie os valores abaixo para testes manuais.',
            [idType]: idToProcess,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
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
            details: error.response ? JSON.stringify(error.response.data) : error.message,
            received_query: req.query
        });
    } finally {
        console.log(`--- [AuthRoutes:/shopee/callback] FIM DO CALLBACK ---\n`);
    }
});

module.exports = router;