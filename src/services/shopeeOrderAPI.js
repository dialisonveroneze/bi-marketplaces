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
    const timestamp = Math.floor(Date.now() / 1000);
    const partner_id = SHOPEE_PARTNER_ID_LIVE;

    // --- CORREÇÃO 1: Consolidação da Lógica do shopId ---
    // Você não precisa de 'baseParams' separada para a URL final se já está construindo a URL diretamente.
    // O shopId para assinatura E para a URL pode ser determinado de forma mais limpa.
    let shopIdForSignature = null;
    let mainAccountIdForUrl = null; // Se main_account_id for usado na URL, prepare-o aqui

    if (idType === 'shop_id') {
        shopIdForSignature = Number(id); // Converter para número
    } else if (idType === 'main_account_id') {
        mainAccountIdForUrl = Number(id); // Prepare para adicionar na URL se for o caso
        // Atenção: O manual da Shopee pede shop_id para a maioria das assinaturas.
        // Se a API que você está chamando realmente usa main_account_id na assinatura,
        // você precisaria ajustar generateShopeeSignature e a base string dela.
        // Por ora, focamos em shop_id para APIs de loja.
    }


    // --- CORREÇÃO 2: Passar shopIdForSignature para generateShopeeSignature APENAS se for shop_id ---
    // A assinatura, conforme o manual, requer shop_id. Se for uma main_account_id que não se mapeia para shop_id,
    // você precisa verificar como a Shopee trata isso na assinatura.
    // Por enquanto, vamos assumir que shop_id é sempre o que vai na assinatura para APIs de loja.
    const signature = generateShopeeSignature(path, partner_id, timestamp, access_token, shopIdForSignature);


    // --- CONSTRUÇÃO DA URL ---
    let url = `${SHOPEE_API_HOST_LIVE}${path}?` +
              `access_token=${access_token}` +
              `&partner_id=${partner_id}` +
              `&sign=${signature}` +
              `&timestamp=${timestamp}`;

    // --- CORREÇÃO 3: EVITAR DUPLICIDADE DO shop_id na URL ---
    // Você tinha duas linhas adicionando shop_id ou main_account_id.
    // Esta é a forma consolidada e mais limpa.
    if (shopIdForSignature) { // Se determinamos um shop_id para usar (ou seja, idType era 'shop_id')
        url += `&shop_id=${shopIdForSignature}`;
    } else if (mainAccountIdForUrl) { // Se for main_account_id e deve ir na URL
        url += `&main_account_id=${mainAccountIdForUrl}`;
    }


    // Adiciona os parâmetros adicionais à URL
    Object.keys(additionalParams).forEach(key => {
        // Cuidado com o cursor: "" precisa ser encodado.
        if (Array.isArray(additionalParams[key]) || typeof additionalParams[key] === 'object') {
            url += `&${key}=${encodeURIComponent(JSON.stringify(additionalParams[key]))}`;
        } else {
            url += `&${key}=${encodeURIComponent(additionalParams[key])}`;
        }
    });

    return url;
}

/**
 * Realiza uma requisição GET genérica para a API da Shopee.
 * @param {string} url - A URL completa e assinada para a requisição.
 * @returns {Promise<object>} A resposta de dados da API da Shopee.
 */
async function sendShopeeGetRequest(url) {
	// --- NOVO LOG AQUI ---
    console.log(`\n--- [ShopeeOrderAPI] Fazendo requisição GET para Shopee ---`);
    console.log(`[ShopeeOrderAPI] URL da Requisição: ${url}`);
    // Para GET, não há body, mas podemos adicionar um log se fosse POST/PUT
    console.log(`---------------------------------------------------------\n`);
    // --- FIM DO NOVO LOG ---
    try {
        const response = await axios.get(url, {
            headers: { 'Content-Type': 'application/json' }
        });
        return response.data;
    } catch (error) {
        console.error('[ShopeeOrderAPI] Erro na requisição Shopee:', error.response ? JSON.stringify(error.response.data) : error.message);
        // Lança um erro com a mensagem da API para ser tratado pela camada de serviço
        throw new Error(`Falha na API da Shopee: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
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
    const path = "/api/v2/order/get_order_detail";
    const url = buildSignedShopeeUrl(path, access_token, id, idType, queryParams);
    return await sendShopeeGetRequest(url);
}

module.exports = {
    getShopeeOrderList,
    getShopeeOrderDetail
};