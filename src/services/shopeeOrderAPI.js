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

    let baseParams = {
        partner_id: partner_id,
        timestamp: timestamp,
        access_token: access_token,
    };

    if (idType === 'shop_id') {
        baseParams.shop_id = Number(id);
    } else if (idType === 'main_account_id') {
        baseParams.main_account_id = Number(id);
    }

    const allParams = { ...baseParams, ...additionalParams };

    // Gera a assinatura usando a função existente que já deve lidar com SHOPEE_API_KEY_LIVE
    // Assumimos que generateShopeeSignature já sabe como acessar SHOPEE_API_KEY_LIVE
    const signature = generateShopeeSignature(path, allParams);

    let url = `${SHOPEE_API_HOST_LIVE}${path}?` +
              `access_token=${access_token}` +
              `&partner_id=${partner_id}` +
              `&sign=${signature}` +
              `&timestamp=${timestamp}`;

    // Adiciona shop_id/main_account_id de volta à URL
    url += (idType === 'shop_id') ? `&shop_id=${Number(id)}` : `&main_account_id=${Number(id)}`;

    // Adiciona os parâmetros adicionais à URL
    Object.keys(additionalParams).forEach(key => {
        // Codifica valores que podem ser arrays ou strings com caracteres especiais
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