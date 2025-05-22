require('dotenv').config();

async function fetchMercadoLivreOrders() {
    console.log('Buscando pedidos do Mercado Livre...');
    // Simulação de chamada
    return [{ id: 1, item: 'Produto Mercado Livre' }];
}

module.exports = {
    fetchMercadoLivreOrders
};
