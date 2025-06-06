// src/services/shopeeOrderAPI.js
const axios = require('axios');
const crypto = require('crypto'); // Necessário para gerar a assinatura, se generateShopeeSignature não usar
const shopeeConfig = require('../config/shopeeConfig'); // Certifique-se de que este caminho está correto
const { generateShopeeSignature } = require('./shopeeAuthService'); // Sua função de assinatura existente

const { SHOPEE_PARTNER_ID_LIVE, SHOPEE_API_HOST_LIVE } = shopeeConfig;
// Nota: SHOPEE_API_KEY_LIVE será usada internamente por generateShopeeSignature

/**
 * Função utilitária para construir a URL completa e assinada para qualquer endpoint da Shopee.
 * Esta função centraliza a lógica de como formatar a requisição para a Shopee.
 * @param {string} path - O caminho do endpoint da API (ex: "/order/get_order_list").
 * @param {string} access_token - Token de acesso do seller.
 * @param {string} id - ID da loja ou conta principal.
 * @param {string} idType - 'shop_id' ou 'main_account_id'.
 * @param {object} additionalParams - Parâmetros específicos da requisição para o endpoint.
 * @returns {string} A URL completa e assinada.
 */
function buildSignedShopeeUrl(path, access_token, id, idType, additionalParams = {}) {
    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] Entrando na função. Path: ${path}`); // NOVO LOG 1
    const timestamp = Math.floor(Date.now() / 1000);
    const partner_id = SHOPEE_PARTNER_ID_LIVE;

    let shopIdForSignature = null;
    let mainAccountIdForUrl = null;

    if (idType === 'shop_id') {
        shopIdForSignature = Number(id); // Converter para número
    } else if (idType === 'main_account_id') {
        mainAccountIdForUrl = Number(id); // Prepare para adicionar na URL se for o caso
        // Para APIs de dados de loja que usam main_account_id,
        // o manual da Shopee especifica que o `shop_id` para a assinatura deve ser 0
        // se a conta principal estiver acessando todas as lojas.
        // Se `id` for um main_account_id, a assinatura ainda usa 0 para shop_id.
        shopIdForSignature = 0; // Usar 0 para shop_id na assinatura quando é main_account_id
    }

    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] Parâmetros para assinatura:`); // NOVO LOG 2
    console.log(`- Path: ${path}`);
    console.log(`- Partner ID: ${partner_id}`);
    console.log(`- Timestamp: ${timestamp}`);
    console.log(`- Access Token (first 5 chars): ${access_token ? access_token.substring(0, 5) + '...' : 'N/A'}`);
    console.log(`- Shop ID (para assinatura, pode ser 0): ${shopIdForSignature}`);

    const signature = generateShopeeSignature(path, partner_id, timestamp, access_token, shopIdForSignature);
    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] Assinatura gerada: ${signature}`); // NOVO LOG 3

    // --- CONSTRUÇÃO DA URL ---
    let url = `${SHOPEE_API_HOST_LIVE}${path}?` +
              `access_token=${access_token}` +
              `&partner_id=${partner_id}` +
              `&sign=${signature}` +
              `&timestamp=${timestamp}`;

    if (shopIdForSignature && idType === 'shop_id') { // Adiciona shop_id apenas se for realmente um shop_id
        url += `&shop_id=${shopIdForSignature}`;
    } else if (mainAccountIdForUrl) { // Adiciona main_account_id se for esse o tipo
        url += `&main_account_id=${mainAccountIdForUrl}`;
    }

    // Adiciona os parâmetros adicionais à URL
    Object.keys(additionalParams).forEach(key => {
        if (Array.isArray(additionalParams[key]) || typeof additionalParams[key] === 'object') {
            url += `&${key}=${encodeURIComponent(JSON.stringify(additionalParams[key]))}`;
        } else {
            url += `&${key}=${encodeURIComponent(additionalParams[key])}`;
        }
    });

    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] URL final construída: ${url}`); // NOVO LOG 4
    return url;
}

/**
 * Realiza uma requisição GET genérica para a API da Shopee.
 * @param {string} url - A URL completa e assinada para a requisição.
 * @returns {Promise<object>} A resposta de dados da API da Shopee.
 */
async function sendShopeeGetRequest(url) {
    console.log(`\n--- [ShopeeOrderAPI:sendShopeeGetRequest] Fazendo requisição GET para Shopee ---`); // NOVO LOG 5
    console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] URL da Requisição: ${url}`);
    console.log(`---------------------------------------------------------\n`);

    try {
        const response = await axios.get(url, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] Resposta recebida da Shopee (Status: ${response.status})`); // NOVO LOG 6
        // CUIDADO: Se você quiser ver o corpo da resposta completa, descomente a linha abaixo.
        // Mas pode ser muito grande em logs de produção.
        // console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] Dados da Resposta: ${JSON.stringify(response.data)}`);

        // Sua lógica atual verifica response.data.error no service, então o retorno aqui é response.data.
        // Se a Shopee retorna um erro HTTP 200 com "error" no JSON, isso é tratado.
        // Se for um erro HTTP (4xx, 5xx), o catch abaixo lida com isso.
        return response.data;
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        const httpStatus = error.response ? error.response.status : 'N/A';
        console.error(`❌ [ShopeeOrderAPI:sendShopeeGetRequest] Erro na requisição Shopee. Status HTTP: ${httpStatus}. Detalhes: ${errorMessage}`); // NOVO LOG 7
        // Lança um erro com a mensagem da API para ser tratado pela camada de serviço
        throw new Error(`Falha na API da Shopee: ${errorMessage}`);
    }
}

/**
 * Obtém a lista de pedidos da Shopee.
 * @param {string} id - ID da loja ou conta principal.
 * @param {string} idType - 'shop_id' ou 'main_account_id'.
 * @param {string} access_token - Token de acesso do seller.
 * @param {object} queryParams - Parâmetros específicos para o endpoint get_order_list.
 * @returns {Promise<object>} Dados da lista de pedidos.
 */
async function getShopeeOrderList(id, idType, access_token, queryParams) {
    console.log(`[ShopeeOrderAPI:getShopeeOrderList] Chamando get_order_list para ID: ${id}`); // NOVO LOG 8
    const path = "/api/v2/order/get_order_list";
    const url = buildSignedShopeeUrl(path, access_token, id, idType, queryParams);
    return await sendShopeeGetRequest(url);
}

/**
 * Obtém os detalhes de pedidos da Shopee.
 * @param {string} id - ID da loja ou conta principal.
 * @param {string} idType - 'shop_id' ou 'main_account_id'.
 * @param {string} access_token - Token de acesso do seller.
 * @param {object} queryParams - Parâmetros específicos para o endpoint get_order_detail.
 * @returns {Promise<object>} Dados detalhados dos pedidos.
 */
async function getShopeeOrderDetail(id, idType, access_token, queryParams) {
    console.log(`[ShopeeOrderAPI:getShopeeOrderDetail] Chamando get_order_detail para ID: ${id}`); // NOVO LOG 9
    const path = "/api/v2/order/get_order_detail";
    const url = buildSignedShopeeUrl(path, access_token, id, idType, queryParams);
    return await sendShopeeGetRequest(url);
}

module.exports = {
    getShopeeOrderList,
    getShopeeOrderDetail
};