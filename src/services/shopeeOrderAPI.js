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
    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] INÍCIO - Construindo URL assinada para o path: ${path}`); // NOVO LOG

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

    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] Parâmetros para generateShopeeSignature:`); // NOVO LOG
    console.log(`- Path: ${path}`);
    console.log(`- Partner ID: ${partner_id}`);
    console.log(`- Timestamp: ${timestamp}`);
    console.log(`- Access Token (primeiros 5 chars): ${access_token ? access_token.substring(0, 5) + '...' : 'N/A'}`);
    console.log(`- Shop ID (usado na assinatura, pode ser 0): ${shopIdForSignature}`);

    const signature = generateShopeeSignature(path, partner_id, timestamp, access_token, shopIdForSignature);
    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] Assinatura gerada: ${signature}`); // NOVO LOG

    let url = `${SHOPEE_API_HOST_LIVE}${path}?` +
              `access_token=${access_token}` +
              `&partner_id=${partner_id}` +
              `&sign=${signature}` +
              `&timestamp=${timestamp}`;

    if (shopIdForSignature && idType === 'shop_id') {
        url += `&shop_id=${shopIdForSignature}`;
    } else if (mainAccountIdForUrl) {
        url += `&main_account_id=${mainAccountIdForUrl}`;
    }

    Object.keys(additionalParams).forEach(key => {
        if (Array.isArray(additionalParams[key]) || typeof additionalParams[key] === 'object') {
            url += `&${key}=${encodeURIComponent(JSON.stringify(additionalParams[key]))}`;
        } else {
            url += `&${key}=${encodeURIComponent(additionalParams[key])}`;
        }
    });

    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] URL final construída: ${url}`); // NOVO LOG
    console.log(`[ShopeeOrderAPI:buildSignedShopeeUrl] FIM - URL assinada construída.`); // NOVO LOG
    return url;
}

/**
 * Realiza uma requisição GET genérica para a API da Shopee.
 * @param {string} url - A URL completa e assinada para a requisição.
 * @returns {Promise<object>} A resposta de dados da API da Shopee.
 */
async function sendShopeeGetRequest(url) {
    console.log(`\n--- [ShopeeOrderAPI:sendShopeeGetRequest] INÍCIO - Fazendo requisição GET para Shopee ---`); // NOVO LOG
    console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] URL da Requisição: ${url}`);
    console.log(`---------------------------------------------------------\n`);

    try {
        const response = await axios.get(url, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] Resposta recebida da Shopee (Status: ${response.status})`); // NOVO LOG
        // console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] Dados da Resposta: ${JSON.stringify(response.data)}`); // Descomentar para ver o body completo da resposta
        console.log(`[ShopeeOrderAPI:sendShopeeGetRequest] FIM - Requisição GET concluída com sucesso.`); // NOVO LOG
        return response.data;
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        const httpStatus = error.response ? error.response.status : 'N/A';
        console.error(`❌ [ShopeeOrderAPI:sendShopeeGetRequest] ERRO na requisição Shopee.`); // NOVO LOG
        console.error(`❌ [ShopeeOrderAPI:sendShopeeGetRequest] Status HTTP: ${httpStatus}.`);
        console.error(`❌ [ShopeeOrderAPI:sendShopeeGetRequest] Detalhes do Erro: ${errorMessage}`);
        console.error(`--- [ShopeeOrderAPI:sendShopeeGetRequest] FIM - Requisição GET falhou ---\n`); // NOVO LOG
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
    console.log(`[ShopeeOrderAPI:getShopeeOrderList] INÍCIO - Chamando get_order_list para ID: ${id}, Tipo: ${idType}`); // NOVO LOG
    const path = "/api/v2/order/get_order_list";
    const url = buildSignedShopeeUrl(path, access_token, id, idType, queryParams);
    const response = await sendShopeeGetRequest(url);
    console.log(`[ShopeeOrderAPI:getShopeeOrderList] FIM - get_order_list concluído.`); // NOVO LOG
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
    console.log(`[ShopeeOrderAPI:getShopeeOrderDetail] INÍCIO - Chamando get_order_detail para ID: ${id}, Tipo: ${idType}`); // NOVO LOG
    const path = "/api/v2/order/get_order_detail";
    const url = buildSignedShopeeUrl(path, access_token, id, idType, queryParams);
    const response = await sendShopeeGetRequest(url);
    console.log(`[ShopeeOrderAPI:getShopeeOrderDetail] FIM - get_order_detail concluído.`); // NOVO LOG
    return response;
}

module.exports = {
    getShopeeOrderList,
    getShopeeOrderDetail
};