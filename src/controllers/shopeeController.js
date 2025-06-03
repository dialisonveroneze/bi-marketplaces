// src/controllers/shopeeController.js
const { supabase } = require('../database');
const { fetchShopeeOrders } = require('../api/shopee/orders');
const { refreshShopeeAccessToken } = require('../api/shopee/auth');

async function processShopeeOrders() {
  console.log('🔄 [processShopeeOrders] Starting Shopee order processing...');
  try {
    const { data: connections, error } = await supabase
      .from('client_connections') // Changed table name
      .select('*')
      .eq('connection_name', 'shopee'); // Filter for Shopee connections

    if (error) {
      console.error('❌ [processShopeeOrders] Error fetching Shopee connections:', error.message);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('📦 [processShopeeOrders] No Shopee connections found to process.');
      return;
    }

    console.log(`📦 [processShopeeOrders] Found ${connections.length} Shopee connections to process.`);

    for (const connection of connections) {
      const { id: connectionId, client_id, access_token, refresh_token, additional_data, access_token_expires_at } = connection;

      // Extract shop_id from additional_data or ensure it's a direct column if needed
      // Assuming shop_id is stored in additional_data or directly on the connection object.
      // If shop_id is a direct column on client_connections, just use connection.shop_id
      const shop_id = additional_data?.shop_id || connection.shop_id; // Adjust based on your schema

      if (!shop_id) {
          console.warn(`⚠️ [processShopeeOrders] Skipping connection ${connectionId}: No shop_id found.`);
          continue;
      }

      console.log(`🛍️ [processShopeeOrders] Processing orders for Shop ID: ${shop_id} (Client ID: ${client_id})`);

      let currentAccessToken = access_token;
      let accessTokenExpiresAt = additional_data?.access_token_expires_at; // Get from additional_data

      // === Token Refresh Logic ===
      const now = new Date();
      let shouldRefresh = false;

      if (!accessTokenExpiresAt) {
          // If expiration date is missing, assume it needs refresh
          console.warn(`⚠️ [processShopeeOrders] Access Token expiration date missing for Shop ID ${shop_id}. Attempting refresh...`);
          shouldRefresh = true;
      } else {
          const expiresAt = new Date(accessTokenExpiresAt);
          const FIVE_MINUTES_IN_MS = 5 * 60 * 1000; // Refresh if less than 5 minutes to expire

          if (expiresAt.getTime() - now.getTime() < FIVE_MINUTES_IN_MS) {
              console.log(`⚠️ [processShopeeOrders] Access Token for Shop ID ${shop_id} expired or close to expiring. Attempting refresh...`);
              shouldRefresh = true;
          }
      }

      if (shouldRefresh) {
        try {
          // Pass connectionId to update the correct row in client_connections
          currentAccessToken = await refreshShopeeAccessToken(connectionId, shop_id, refresh_token);
        } catch (refreshError) {
          console.error(`❌ [processShopeeOrders] Failed to refresh token for Shop ID ${shop_id}. Skipping this connection.`);
          continue; // Skip to the next connection if refresh fails
        }
      }
      // ===========================

      try {
        await fetchShopeeOrders({ client_id, shop_id, access_token: currentAccessToken }); // Use the potentially refreshed token
        console.log(`✅ [processShopeeOrders] Orders for Shop ID: ${shop_id} processed successfully.`);
      } catch (orderError) {
        console.error(`❌ [processShopeeOrders] Error fetching orders for Shop ID ${shop_id}:`, orderError.message);
      }
    }
    console.log('🎉 [processShopeeOrders] Shopee order processing completed.');
  } catch (globalError) {
    console.error('🔥 [processShopeeOrders] Unexpected error during Shopee order processing:', globalError.message);
  }
}

module.exports = {
  processShopeeOrders,
};