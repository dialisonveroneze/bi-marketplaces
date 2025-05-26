const fetchShopeeOrders = require('./src/jobs/fetchShopeeOrders');
const normalizeShopee = require('./src/jobs/normalizeShopee');

console.log('Iniciando aplicação...');

(async () => {
  await fetchShopeeOrders();
  await normalizeShopee();
})();
