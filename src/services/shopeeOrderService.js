// src/services/shopeeOrderService.js
const axios = require('axios');
const crypto = require('crypto');
const supabase = require('../config/supabaseClient'); // Assumindo que você tem isso configurado

const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTENER_ID; // CORRIGIDO: typo
const SHOPEE_PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;
// URL da API de Pedidos para o Brasil (ou conforme sua necessidade)
const SHOPEE_ORDER_API_BASE_URL = 'https://openplatform.shopee.com.br/api/v2/order';

/**
 * Gera a assinatura HMAC-SHA256 para requisições da Shopee API.
 * @param {string} path - O caminho da API (ex: "/api/v2/order/get_order_detail").
 * @param {number} timestamp - O timestamp da requisição.
 * @param {string} accessToken - O access token do shop.
 * @param {number} shopId - O ID do shop.
 * @returns {string} A assinatura gerada.
 */
function generateSignature(path, timestamp, accessToken, shopId) {
    const baseString = `${SHOPEE_PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', SHOPEE_PARTNER_KEY)
                       .update(baseString)
                       .digest('hex');
    return sign;
}

/**
 * Busca detalhes de pedidos específicos da Shopee para um determinado shop.
 * @param {number} clientDbId - O ID interno do cliente no seu DB (da tabela client_connections).
 * @param {string[]} orderSnList - Uma lista de Order SNs (números de série dos pedidos) para buscar. Limit 1 a 50.
 * @returns {Promise<object>} Os detalhes dos pedidos.
 */
async function getOrderDetail(clientDbId, orderSnList) {
    try {
        // 1. Obter tokens e shop_id do banco de dados
        const { data: connection, error: dbError } = await supabase
            .from('client_connections')
            .select('client_id, access_token, refresh_token') // client_id aqui é o shop_id da Shopee
            .eq('id', clientDbId) // Assume que clientDbId é o 'id' da linha na sua tabela client_connections
            .single();

        if (dbError || !connection) {
            console.error('Erro ao buscar conexão no DB para client_id:', clientDbId, dbError?.message);
            throw new Error('Conexão da Shopee não encontrada no banco de dados.');
        }

        const shopId = connection.client_id;
        const accessToken = connection.access_token;
        // const refreshToken = connection.refresh_token; // Não precisamos do refresh_token para esta API

        // 2. Preparar parâmetros comuns da API
        const path = '/api/v2/order/get_order_detail';
        const timestamp = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
        const sign = generateSignature(path, timestamp, accessToken, shopId);

        // 3. Preparar parâmetros específicos da requisição
        if (!Array.isArray(orderSnList) || orderSnList.length === 0 || orderSnList.length > 50) {
            throw new Error('orderSnList deve ser um array com 1 a 50 order_sn.');
        }
        const orderSnListParam = orderSnList.join(','); // Converte o array para string separada por vírgulas

        // 4. Construir a URL completa
        const requestUrl = `${SHOPEE_ORDER_API_BASE_URL}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}&order_sn_list=${orderSnListParam}`;

        console.log(`--- [ShopeeOrderService:getOrderDetail] INÍCIO DA REQUISIÇÃO ---`);
        console.log(`  URL de Requisição: ${requestUrl}`);

        // 5. Fazer a requisição GET
        const response = await axios.get(requestUrl);

        console.log(`--- [ShopeeOrderService:getOrderDetail] RESPOSTA DA SHOPEE ---`);
        console.log(`  Status HTTP: ${response.status}`);
        console.log(`  Dados da Resposta (JSON recebido): ${JSON.stringify(response.data)}`);
        console.log(`--- [ShopeeOrderService:getOrderDetail] FIM DA REQUISIÇÃO ---`);

        if (response.data.error) {
            console.error(`Erro da Shopee API: ${response.data.error} - ${response.data.message}`);
            throw new Error(`Erro da Shopee API: ${response.data.message}`);
        }

        return response.data.response.order_list; // Retorna a lista de pedidos
    } catch (error) {
        console.error('❌ [ShopeeOrderService:getOrderDetail] Erro ao buscar detalhes do pedido da Shopee:', error.message);
        throw error;
    }
}

module.exports = {
    getOrderDetail
};