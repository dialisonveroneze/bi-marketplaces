// src/services/shopeeOrderAPI.js
const axios = require('axios');
const shopeeConfig = require('../config/shopeeConfig');
const authService = require('./shopeeAuthService'); // Importar authService para usar generateShopeeSignature

const {
    SHOPEE_API_HOST_LIVE,
    SHOPEE_PARTNER_ID_LIVE
} = shopeeConfig;

async function buildSignedShopeeUrl(path, params, accessToken, shopId) {
    console.log(`\n[ShopeeOrderAPI:buildSignedShopeeUrl] INÍCIO - Construindo URL assinada para o path: ${path}`);
    const timestamp = Math.floor(Date.now() / 1000);

    // Adiciona os parâmetros essenciais para a URL que não estão nos 'params' passados
    const allQueryParams = {
        ...params,
        partner_id: SHOPEE_PARTNER_ID_LIVE,
        timestamp: timestamp,
        access_token: accessToken,
        shop_id: shopId, // shopId sempre deve ser incluído na URL para APIs de loja
    };

    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] Parâmetros para generateShopeeSignature:`);
    console.log(`- Path: ${path}`);
    console.log(`- Partner ID: ${allQueryParams.partner_id}`);
    console.log(`- Timestamp: ${allQueryParams.timestamp}`);
    console.log(`- Access Token (primeiros 5 chars): ${allQueryParams.access_token.substring(0, 5)}...`);
    console.log(`- Shop ID (usado na assinatura, pode ser 0): ${allQueryParams.shop_id}`); // Log mais preciso

    // Gerar a assinatura (a baseString agora já está com shopId incluído)
    const sign = authService.generateShopeeSignature(
        path,
        allQueryParams.partner_id,
        allQueryParams.timestamp,
        allQueryParams.access_token,
        allQueryParams.shop_id
    );

    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] Assinatura gerada: ${sign}`);

    // Construir a string de query com parâmetros em ordem alfabética para a URL
    // Excluímos o 'sign' e o 'timestamp' daqui temporariamente para ordenação,
    // e o 'sign' será adicionado por último, e o 'timestamp' já está no objeto
    const orderedQueryParams = {};
    Object.keys(allQueryParams).sort().forEach(key => {
        orderedQueryParams[key] = allQueryParams[key];
    });

    let queryString = Object.keys(orderedQueryParams)
        .map(key => {
            // Encode apenas o valor do parâmetro.
            // Para `cursor: ""` (string vazia), o encodeURIComponent resultaria em `""` -> `%22%22`
            // que é o que a Shopee espera para string vazia entre aspas.
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

async function sendShopeeGetRequest(url) {
    console.log(`\n--- [ShopeeOrderAPI:sendShopeeGetRequest] INÍCIO - Fazendo requisição GET para Shopee ---`);
    console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] URL da Requisição: ${url}`);
    console.log(`---------------------------------------------------------\n`);
    try {
        const response = await axios.get(url);
        console.log(`✅ [ShopeeOrderAPI:sendShopeeGetRequest] RESPOSTA DA SHOPEE - Status HTTP: ${response.status}`);
        console.log(`✅ [ShopeeOrderAPI:sendShopeeGetRequest] Dados da Resposta (JSON recebido): ${JSON.stringify(response.data)}\n`);
        return response.data;
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

async function getShopeeOrderList(connectionInfo, params) {
    console.log(`[ShopeeOrderAPI:getShopeeOrderList] INÍCIO - Chamando get_order_list para ID: ${connectionInfo.shop_id}, Tipo: shop_id`);
    try {
        const url = await buildSignedShopeeUrl(
            "/api/v2/order/get_order_list",
            params,
            connectionInfo.access_token,
            connectionInfo.shop_id
        );
        const responseData = await sendShopeeGetRequest(url);
        console.log(`[ShopeeOrderAPI:getShopeeOrderList] FIM - Dados de pedidos recebidos com sucesso.`);
        return responseData.response;
    } catch (error) {
        console.error(`❌ [ShopeeOrderAPI:getShopeeOrderList] Erro ao obter lista de pedidos da Shopee: ${error.message}`);
        throw error;
    }
}


module.exports = {
    getShopeeOrderList
};