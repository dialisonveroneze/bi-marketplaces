// src/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const { getOrderDetail } = require('../services/shopeeOrderService');

// Rota de teste para buscar detalhes de pedidos
// Para usar esta rota, você precisará saber o 'id' da sua conexão no DB (da tabela client_connections)
// E uma lista de order_sn de teste.
router.get('/orders/detail/:dbClientId', async (req, res) => {
    const dbClientId = parseInt(req.params.dbClientId); // ID da linha na sua tabela client_connections
    // IMPORTANTE: Substitua com um order_sn REAL da sua loja para testar!
    // Você pode pegar um order_sn de um pedido COMPLETO ou PENDENTE do seu Seller Center da Shopee.
    const testOrderSnList = ["250606RPNR8UXV"]; // <-- COLOQUE AQUI UM ORDER_SN VÁLIDO DA SUA LOJA

    if (isNaN(dbClientId)) {
        return res.status(400).json({ error: 'ID do cliente inválido. O ID deve ser um número inteiro.' });
    }

    try {
        const orderDetails = await getOrderDetail(dbClientId, testOrderSnList);
        res.json({
            message: `Detalhes dos pedidos para client ID ${dbClientId} obtidos com sucesso!`,
            orders: orderDetails
        });
    } catch (error) {
        console.error('Erro na rota /api/orders/detail:', error.message);
        res.status(500).json({ error: 'Erro ao obter detalhes dos pedidos.', details: error.message });
    }
});

module.exports = router;