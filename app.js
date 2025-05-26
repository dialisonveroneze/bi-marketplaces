const fetchShopeeOrders = require('./src/jobs/fetchShopeeOrders');
const normalizeShopee = require('./src/jobs/normalizeShopee');

(async () => {
  await fetchShopeeOrders();
  await normalizeShopee();
})();
