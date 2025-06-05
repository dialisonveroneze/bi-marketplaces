// src/routes/shopeeApiRoutes.js
const express = require('express');
const router = express.Router();
const shopeeOrderService = require('../services/shopeeOrderService');

// Endpoint para buscar e salvar pedidos brutos da Shopee
router.get('/fetch-orders', async (req, res) => {
    const { shopId, mainAccountId, orderStatus, daysAgo } = req.query;

    if (!shopId && !mainAccountId) {
        return res.status(400).json({ error: 'shopId ou mainAccountId é obrigatório na query.' });
    }

    const id = shopId || mainAccountId;
    const idType = shopId ? 'shop_id' : 'main_account_id';
    const status = orderStatus || 'READY_TO_SHIP';
    const days = parseInt(daysAgo) || 7;

    try {
        const orders = await shopeeOrderService.fetchAndSaveShopeeOrders(id, idType, status, days);
        if (orders.length > 0) {
            res.status(200).json({ message: 'Pedidos brutos buscados e salvos com sucesso!', count: orders.length });
        } else {
            res.status(200).json({ message: 'Nenhuns pedidos encontrados para o status e período especificados.', count: 0 });
        }
    } catch (error) {
        console.error('❌ [API_ROUTE] Erro na busca de pedidos:', error.message);
        res.status(500).json({ error: 'Falha ao buscar pedidos da Shopee.', details: error.message });
    }
});

// Endpoint para normalizar pedidos brutos para a tabela orders_detail_normalized
router.get('/normalize', async (req, res) => {
    const clientId = req.query.clientId || 1; // Pode ser passado como parâmetro na query

    try {
        const normalizedCount = await shopeeOrderService.normalizeShopeeOrders(clientId);
        res.status(200).json({ message: 'Pedidos normalizados com sucesso!', normalizedCount: normalizedCount });
    } catch (error) {
        console.error('❌ [NORMALIZER] Erro geral no processo de normalização:', error.message);
        res.status(500).json({ error: 'Falha no processo de normalização de pedidos.', details: error.message });
    }
});

module.exports = router;