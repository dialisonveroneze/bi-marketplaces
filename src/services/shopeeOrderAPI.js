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
    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] INÍCIO - Construindo URL assinada para o path: ${path}`);

    const timestamp = Math.floor(Date.now() / 1000);
    const partner_id = SHOPEE_PARTNER_ID_LIVE;

    let shopIdForSignature = null; // Usado na base string da assinatura
    let shopIdForUrl = null;        // Usado como parâmetro 'shop_id' na URL
    let mainAccountIdForUrl = null; // Usado como parâmetro 'main_account_id' na URL

    if (idType === 'shop_id') {
        shopIdForSignature = Number(id);
        shopIdForUrl = Number(id);
    } else if (idType === 'main_account_id') {
        mainAccountIdForUrl = Number(id);
        // Conforme o manual, se `id` é uma main_account_id, o `shop_id` para a assinatura é 0 para APIs de loja
        shopIdForSignature = 0;
    }

    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] Parâmetros para generateShopeeSignature:`);
    console.log(`- Path: ${path}`);
    console.log(`- Partner ID: ${partner_id}`);
    console.log(`- Timestamp: ${timestamp}`);
    console.log(`- Access Token (primeiros 5 chars): ${access_token ? access_token.substring(0, 5) + '...' : 'N/A'}`);
    console.log(`- Shop ID (usado na assinatura, pode ser 0): ${shopIdForSignature}`);

    // Geração da assinatura (a ordem da base string para assinatura permanece a mesma)
    const signature = generateShopeeSignature(path, partner_id, timestamp, access_token, shopIdForSignature);
    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] Assinatura gerada: ${signature}`);

    // --- LÓGICA REVISADA: CONSTRUIR A QUERY STRING COM A ORDEM ESPECÍFICA DO MANUAL ---
    let queryParts = [];

    // Objeto temporário para gerenciar todos os parâmetros que podem ir na URL
    const allParams = {
        // Parâmetros obrigatórios para a URL (que serão colocados na ordem definida)
        access_token: access_token,
        partner_id: partner_id,
        timestamp: timestamp,
        sign: signature,
        // Adiciona os additionalParams que podem sobrescrever ou complementar
        ...additionalParams
    };

    // Adiciona shop_id ou main_account_id ao objeto de parâmetros se aplicável
    if (shopIdForUrl) {
        allParams.shop_id = shopIdForUrl;
    } else if (mainAccountIdForUrl) {
        allParams.main_account_id = mainAccountIdForUrl;
    }

    // Define a ordem desejada para os parâmetros da URL, baseada no seu exemplo do manual.
    // Esta ordem é CRÍTICA e NÃO é alfabética.
    const prescribedOrderKeys = [
        "page_size",
        "response_optional_fields",
        "timestamp",
        "shop_id",           // Pode ser 'shop_id' ou 'main_account_id'
        "main_account_id",   // Incluído na ordem para tratamento
        "order_status",
        "partner_id",
        "access_token",
        "cursor",
        "time_range_field",
        "time_from",
        "time_to",
        "sign"
    ];

    // Adiciona os parâmetros na ordem prescrita
    prescribedOrderKeys.forEach(key => {
        // Verifica se o parâmetro existe no allParams e não é undefined/null
        if (allParams[key] !== undefined && allParams[key] !== null) {
            let value = allParams[key];
            // Encodar arrays ou objetos para JSON string antes de encodeURIComponent
            if (Array.isArray(value) || typeof value === 'object') {
                value = JSON.stringify(value);
            }
            queryParts.push(`${key}=${encodeURIComponent(value)}`);
            delete allParams[key]; // Remove o parâmetro já adicionado para evitar duplicação
        }
    });

    // Adiciona quaisquer outros 'additionalParams' que não foram explicitamente listados na ordem prescrita.
    // Estes serão adicionados no final, ordenados alfabeticamente entre si para consistência.
    Object.keys(allParams).sort().forEach(key => {
        let value = allParams[key];
        if (Array.isArray(value) || typeof value === 'object') {
            value = JSON.stringify(value);
        }
        queryParts.push(`${key}=${encodeURIComponent(value)}`);
    });

    const queryString = queryParts.join('&');
    const url = `${SHOPEE_API_HOST_LIVE}${path}?${queryString}`;

    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] URL final construída (com parâmetros na ordem do manual): ${url}`);
    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] FIM - URL assinada construída.`);
    return url;
}

/**
 * Realiza uma requisição GET genérica para a API da Shopee.
 * @param {string} url - A URL completa e assinada para a requisição.
 * @returns {Promise<object>} A resposta de dados da API da Shopee.
 */
async function sendShopeeGetRequest(url) {
    console.log(`\n--- [ShopeeOrderAPI:sendShopeeGetRequest] INÍCIO - Fazendo requisição GET para Shopee ---`);
    console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] URL da Requisição: ${url}`);
    console.log(`---------------------------------------------------------\n`);

    try {
        const response = await axios.get(url, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] Resposta recebida da Shopee (Status: ${response.status})`);
        // console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] Dados da Resposta: ${JSON.stringify(response.data)}`); // Descomentar para ver o body completo da resposta
        console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] FIM - Requisição GET concluída com sucesso.`);
        return response.data;
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        const httpStatus = error.response ? error.response.status : 'N/A';
        console.error(`❌ [ShopeeOrderAPI:sendShopeeGetRequest] ERRO na requisição Shopee.`);
        console.error(`❌ [ShopeeOrderAPI:sendShopeeGetRequest] Status HTTP: ${httpStatus}.`);
        console.error(`❌ [ShopeeOrderAPI:sendShopeeGetRequest] Detalhes do Erro: ${errorMessage}`);
        console.error(`--- [ShopeeOrderAPI:sendShopeeGetRequest] FIM - Requisição GET falhou ---\n`);
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
    console.log(`[ShopeeOrderAPI:getShopeeOrderList] INÍCIO - Chamando get_order_list para ID: ${id}, Tipo: ${idType}`);
    const path = "/api/v2/order/get_order_list";
    const url = buildSignedShopeeUrl(path, access_token, id, idType, queryParams);
    const response = await sendShopeeGetRequest(url);
    console.log(`[ShopeeOrderAPI:getShopeeOrderList] FIM - get_order_list concluído.`);
    return response;
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
    console.log(`[ShopeeOrderAPI:getShopeeOrderDetail] INÍCIO - Chamando get_order_detail para ID: ${id}, Tipo: ${idType}`);
    const path = "/api/v2/order/get_order_detail";
    const url = buildSignedShopeeUrl(path, access_token, id, idType, queryParams);
    const response = await sendShopeeGetRequest(url);
    console.log(`[ShopeeOrderAPI:getShopeeOrderDetail] FIM - get_order_detail concluído.`);
    return response;
}

module.exports = {
    getShopeeOrderList,
    getShopeeOrderDetail
};