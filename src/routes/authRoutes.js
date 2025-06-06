// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
// CORREÇÃO AQUI: Caminho para supabaseClient, assumindo src/config/supabaseClient.js
const supabase = require('../config/supabaseClient');

// Certifique-se de que estas variáveis de ambiente estão definidas no seu ambiente de hospedagem (Render)
const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTNER_ID;
const SHOPEE_PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;
const SHOPEE_REDIRECT_URL = process.env.SHOPEE_REDIRECT_URL;
const SHOPEE_API_BASE_URL = 'https://partner.shopeemobile.com/api/v2';
const SHOPEE_AUTH_URL = 'https://partner.shopeemobile.com/api/v2/shop/auth_partner'; // URL de autorização

// Array de URLs de base da API para diferentes regiões (se necessário)
const SHOPEE_API_REGION_URLS = {
    // Você pode adicionar mais regiões aqui, se precisar
    'BR': 'https://openplatform.shopee.com.br/api/v2', // Exemplo para o Brasil
    'GLOBAL': 'https://partner.shopeemobile.com/api/v2', // URL padrão para acesso global
    'TEST_GLOBAL': 'https://openplatform.sandbox.test-stable.shopee.sg/api/v2' // URL de Sandbox para testes
};

// --- Função para Geração de Assinatura HMAC-SHA256 ---
function generateSignature(path, timestamp, accessToken, shopId) {
    const baseString = `${SHOPEE_PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', SHOPEE_PARTNER_KEY)
                       .update(baseString)
                       .digest('hex');
    return sign;
}

// --- Rota de Início da Autorização (Passo 1) ---
router.get('/shopee/authorize', (req, res) => {
    // Verifique se as variáveis de ambiente cruciais estão definidas
    if (!SHOPEE_PARTNER_ID || !SHOPEE_REDIRECT_URL || !SHOPEE_PARTNER_KEY) {
        console.error('❌ ERRO: Variáveis de ambiente da Shopee não configuradas corretamente para autorização.');
        return res.status(500).send('Erro de configuração do servidor. Variáveis de ambiente da Shopee ausentes.');
    }

    console.log(`--- [AuthRoutes:/shopee/authorize] INÍCIO DA AUTORIZAÇÃO ---`);
    console.log(`  SHOPEE_PARTNER_ID: ${SHOPEE_PARTNER_ID}`);
    console.log(`  SHOPEE_REDIRECT_URL: ${SHOPEE_REDIRECT_URL}`);
    console.log(`  SHOPEE_PARTNER_KEY: ${SHOPEE_PARTNER_KEY ? '******' : 'NÃO CONFIGURADO'}`); // Não logar a chave real

    // URL de redirecionamento para o usuário autorizar sua loja
    const authUrl = `${SHOPEE_AUTH_URL}?partner_id=${SHOPEE_PARTNER_ID}&redirect=${encodeURIComponent(SHOPEE_REDIRECT_URL)}`;
    console.log(`  Redirecionando para Shopee Auth URL: ${authUrl}`);
    console.log(`--- [AuthRoutes:/shopee/authorize] FIM DA AUTORIZAÇÃO ---`);
    res.redirect(authUrl);
});

// --- Rota de Callback da Shopee (Passo 2) ---
router.get('/shopee/callback', async (req, res) => {
    console.log(`--- [AuthRoutes:/shopee/callback] INÍCIO DO CALLBACK ---`);
    console.log('  Query Params Recebidos:', req.query);

    const { code, shop_id: shopeeShopId, partner_id: shopeePartnerId } = req.query;

    if (!code || !shopeeShopId || !shopeePartnerId) {
        console.error('❌ ERRO: Parâmetros essenciais (code, shop_id, partner_id) ausentes no callback da Shopee.');
        return res.status(400).send('Parâmetros de callback inválidos.');
    }

    console.log(`  Processando callback para shop_id: ${shopeeShopId}`);

    try {
        const path = '/api/v2/auth/token/get';
        const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp atual em segundos

        // O access_token é vazio na chamada inicial /auth/token/get
        // O shop_id é o shopeeShopId da query
        const sign = generateSignature(path, timestamp, '', shopeeShopId);

        const requestBody = {
            code: code,
            shop_id: parseInt(shopeeShopId), // Converter para número inteiro
            partner_id: parseInt(shopeePartnerId) // Converter para número inteiro
        };

        const tokenUrl = `${SHOPEE_API_BASE_URL}${path}`;
        const queryParams = `partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;
        const finalUrl = `${tokenUrl}?${queryParams}`;

        console.log(`  Corpo da Requisição (JSON enviado): ${JSON.stringify(requestBody)}`);
        console.log(`  Parâmetros para Assinatura (baseString): ${SHOPEE_PARTNER_ID}${path}${timestamp}${''}${shopeeShopId}`);
        console.log(`  Assinatura Gerada (sign): ${sign}`);

        console.log(`--- [AuthService:getAccessTokenFromCode] INÍCIO DA REQUISIÇÃO ---`);
        const tokenResponse = await axios.post(finalUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`--- [AuthService:getAccessTokenFromCode] RESPOSTA DA SHOPEE ---`);
        console.log(`  Status HTTP: ${tokenResponse.status}`);
        console.log(`  Dados da Resposta (JSON recebido): ${JSON.stringify(tokenResponse.data)}`);
        console.log(`--- [AuthService:getAccessTokenFromCode] FIM DA REQUISIÇÃO ---`);

        const { access_token, refresh_token, expire_in, error, message, request_id } = tokenResponse.data;

        if (error) {
            console.error(`❌ Erro na resposta do token da Shopee: ${error} - ${message} (Request ID: ${request_id})`);
            return res.status(500).send(`Erro ao obter tokens da Shopee: ${message}`);
        }

        if (!access_token || !refresh_token) {
            console.error('❌ ERRO: Access Token ou Refresh Token não recebidos da Shopee.');
            return res.status(500).send('Não foi possível obter os tokens de acesso da Shopee.');
        }

        // Calcular a data de expiração do access token
        const accessTokenExpiresAt = new Date(Date.now() + expire_in * 1000); // expire_in está em segundos

        // Dados para upsert no Supabase
        const upsertData = {
            client_id: parseInt(shopeeShopId), // Usar o shop_id como client_id para consistência
            connection_name: `Shopee Shop ${shopeeShopId}`,
            access_token: access_token,
            refresh_token: refresh_token,
            access_token_expires_at: accessTokenExpiresAt.toISOString(), // Salvar como ISO string
            updated_at: new Date().toISOString(),
            // Guardar dados adicionais relevantes, como partner_id e o shop_id original (string)
            additional_data: {
                partner_id: parseInt(shopeePartnerId),
                original_shop_id_shopee: shopeeShopId
            }
        };

        console.log(`  Dados para upsert na tabela 'client_connections': ${JSON.stringify(upsertData)}`);
        console.log(`  Chave de Conflito para Upsert no Supabase: 'client_id'`);

        // Realizar upsert no Supabase
        const { data: upsertedData, error: upsertError } = await supabase
            .from('client_connections')
            .upsert(upsertData, { onConflict: 'client_id' }) // Chave de conflito deve ser 'client_id'
            .select(); // Adicione .select() para retornar os dados inseridos/atualizados

        if (upsertError) {
            console.error('❌ [AuthRoutes:/shopee/callback] Erro ao salvar/atualizar tokens no Supabase:', upsertError.message);
            return res.status(500).send(`Erro ao salvar tokens no banco de dados: ${upsertError.message}`);
        }

        console.log(`✅ [AuthRoutes:/shopee/callback] Tokens salvos/atualizados no Supabase para shop_id: ${shopeeShopId}.`);
        console.log(`  Dados retornados pelo upsert: ${JSON.stringify(upsertedData)}`);

        // Resposta de sucesso para o cliente
        res.status(200).json({
            message: 'Access Token e Refresh Token obtidos e salvos no banco de dados com sucesso! Copie os valores abaixo para testes manuais.',
            shop_id: shopeeShopId,
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresIn: expire_in
        });

    } catch (error) {
        console.error('❌ [AuthRoutes:/shopee/callback] Erro no fluxo de callback da Shopee:', error.message);
        // Em caso de erro na requisição HTTP ou outro erro, envie uma resposta de erro.
        res.status(500).send(`Erro interno do servidor durante o callback da Shopee: ${error.message}`);
    } finally {
        console.log(`--- [AuthRoutes:/shopee/callback] FIM DO CALLBACK ---`);
    }
});

module.exports = router;