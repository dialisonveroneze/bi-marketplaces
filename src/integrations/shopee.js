require('dotenv').config();

async function fetchShopeeOrders() {
    console.log('Buscando pedidos da Shopee...');
    // Simulação de chamada
    return [{ id: 1, item: 'Produto Shopee' }];
}

module.exports = {
    fetchShopeeOrders
};
