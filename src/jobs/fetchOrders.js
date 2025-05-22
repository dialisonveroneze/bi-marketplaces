const { fetchShopeeOrders } = require('../integrations/shopee');
const { fetchMercadoLivreOrders } = require('../integrations/mercadoLivre');
const { getClients } = require('../clients/client.service');

async function fetchOrders() {
    const clients = await getClients();

    console.log('Clientes:', clients);

    const shopeeOrders = await fetchShopeeOrders();
    const mercadoLivreOrders = await fetchMercadoLivreOrders();

    console.log('Pedidos Shopee:', shopeeOrders);
    console.log('Pedidos Mercado Livre:', mercadoLivreOrders);
}

module.exports = fetchOrders;
