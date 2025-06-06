// src/services/shopeeOrderAPI.js
const axios = require('axios');
const shopeeConfig = require('../config/shopeeConfig');
const authService = require('./shopeeAuthService'); // Importar authService para usar generateShopeeSignature

const {
    SHOPEE_API_HOST_LIVE,
    SHOPEE_PARTNER_ID_LIVE
} = shopeeConfig;

// buildSignedShopeeUrl agora recebe access_token e shopId explicitamente
async function buildSignedShopeeUrl(path, params, accessToken, shopId) {
    console.log(`\n[ShopeeOrderAPI:buildSignedShopeeUrl] INÍCIO - Construindo URL assinada para o path: ${path}`);
    const timestamp = Math.floor(Date.now() / 1000);

    // Adiciona os parâmetros essenciais para a URL que não estão nos 'params' passados
    const allQueryParams = {
        ...params,
        partner_id: SHOPEE_PARTNER_ID_LIVE,
        timestamp: timestamp,
        access_token: accessToken, // Agora access_token é passado aqui
        shop_id: shopId,          // Agora shopId é passado aqui
    };

    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] Parâmetros para generateShopeeSignature:`);
    console.log(`- Path: ${path}`);
    console.log(`- Partner ID: ${allQueryParams.partner_id}`);
    console.log(`- Timestamp: ${allQueryParams.timestamp}`);
    // Acesso seguro a access_token e shop_id para logs, pois sabemos que eles existem aqui
    console.log(`- Access Token (primeiros 5 chars): ${accessToken.substring(0, 5)}...`);
    console.log(`- Shop ID (usado na assinatura, pode ser 0): ${shopId}`);

    // Gerar a assinatura (a baseString agora já está com shopId incluído)
    const sign = authService.generateShopeeSignature(
        path,
        allQueryParams.partner_id,
        allQueryParams.timestamp,
        accessToken, // Usar o accessToken passado diretamente
        shopId       // Usar o shopId passado diretamente
    );

    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] Assinatura gerada: ${sign}`);

    // Construir a string de query com parâmetros em ordem alfabética para a URL
    const orderedQueryParams = {};
    Object.keys(allQueryParams).sort().forEach(key => {
        orderedQueryParams[key] = allQueryParams[key];
    });

    let queryString = Object.keys(orderedQueryParams)
        .map(key => {
            return `${key}=${encodeURIComponent(orderedQueryParams[key])}`;
        })
        .join('&');
    
    // Adicionar o sign no final da queryString, conforme o exemplo da Shopee.
    queryString += `&sign=${sign}`;

    const url = `${SHOPEE_API_HOST_LIVE}${path}?${queryString}`;

    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] URL final construída (com parâmetros em ordem alfabética e sign no final): ${url}`);
    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] FIM - URL assinada construída.\n`);

    return url;
}

// getShopeeOrderList agora desestrutura connectionInfo para passar explicitamente
// access_token e shop_id para buildSignedShopeeUrl
async function getShopeeOrderList(connectionInfo, params) {
    // Adicionar verificação para connectionInfo e suas propriedades
    if (!connectionInfo || !connectionInfo.shop_id || !connectionInfo.access_token) {
        const errorMsg = 'Informações de conexão incompletas para getShopeeOrderList.';
        console.error(`❌ [ShopeeOrderAPI:getShopeeOrderList] Erro: ${errorMsg}`);
        throw new Error(errorMsg);
    }

    console.log(`[ShopeeOrderAPI:getShopeeOrderList] INÍCIO - Chamando get_order_list para ID: ${connectionInfo.shop_id}, Tipo: shop_id`);
    try {
        const url = await buildSignedShopeeUrl(
            "/api/v2/order/get_order_list",
            params,
            connectionInfo.access_token, // Passando access_token explicitamente
            connectionInfo.shop_id       // Passando shop_id explicitamente
        );
        const responseData = await sendShopeeGetRequest(url);
        console.log(`[ShopeeOrderAPI:getShopeeOrderList] FIM - Dados de pedidos recebidos com sucesso.`);
        return responseData.response; // Retorna apenas o objeto 'response'
    } catch (error) {
        console.error(`❌ [ShopeeOrderAPI:getShopeeOrderList] Erro ao obter lista de pedidos da Shopee: ${error.message}`);
        throw error;
    }
}


// Função para obter detalhes de pedidos (mantendo o mesmo padrão de parâmetros)
async function getShopeeOrderDetail(connectionInfo, params) {
    if (!connectionInfo || !connectionInfo.shop_id || !connectionInfo.access_token) {
        const errorMsg = 'Informações de conexão incompletas para getShopeeOrderDetail.';
        console.error(`❌ [ShopeeOrderAPI:getShopeeOrderDetail] Erro: ${errorMsg}`);
        throw new Error(errorMsg);
    }
    console.log(`[ShopeeOrderAPI:getShopeeOrderDetail] INÍCIO - Chamando get_order_detail para ID: ${connectionInfo.shop_id}, Tipo: shop_id`);
    try {
        const url = await buildSignedShopeeUrl(
            "/api/v2/order/get_order_detail",
            params,
            connectionInfo.access_token, // Passando access_token explicitamente
            connectionInfo.shop_id       // Passando shop_id explicitamente
        );
        const responseData = await sendShopeeGetRequest(url);
        console.log(`[ShopeeOrderAPI:getShopeeOrderDetail] FIM - Detalhes de pedidos recebidos com sucesso.`);
        return responseData.response; // Retorna apenas o objeto 'response'
    } catch (error) {
        console.error(`❌ [ShopeeOrderAPI:getShopeeOrderDetail] Erro ao obter detalhes de pedidos da Shopee: ${error.message}`);
        throw error;
    }
}


async function sendShopeeGetRequest(url) {
    console.log(`\n--- [ShopeeOrderAPI:sendShopeeGetRequest] INÍCIO - Fazendo requisição GET para Shopee ---`);
    console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] URL da Requisição: ${url}`);
    console.log(`---------------------------------------------------------\n`);
    try {
        const response = await axios.get(url);
        console.log(`✅ [ShopeeOrderAPI:sendShopeeGetRequest] RESPOSTA DA SHOPEE - Status HTTP: ${response.status}`);
        console.log(`✅ [ShopeeOrderAPI:sendShopeeGetRequest] Dados da Resposta (JSON recebido): ${JSON.stringify(response.data)}\n`);
        return response.data; // Retorna o objeto completo de dados da resposta
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`❌ [ShopeeOrderAPI:sendShopeeGetRequest] ERRO na requisição Shopee.`);
        console.error(`❌ [ShopeeOrderAPI:sendShopeeGetRequest] Status HTTP: ${error.response ? error.response.status : 'N/A'}.`);
        console.error(`❌ [ShopeeOrderAPI:sendShopeeGetRequest] Detalhes do Erro: ${errorMessage}\n`);
        throw new Error(`Falha na API da Shopee: ${errorMessage}`);
    } finally {
        console.log(`--- [ShopeeOrderAPI:sendShopeeGetRequest] FIM - Requisição GET falhou ---\n`);
    }
}


module.exports = {
    getShopeeOrderList,
    getShopeeOrderDetail // Exportar também getShopeeOrderDetail
};