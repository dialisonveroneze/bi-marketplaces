// src/api/shopee/auth.js

const axios = require('axios');
const { supabase } = require('../../database');
const { generateShopeeSignature } = require('../../utils/security');

// Ensure these environment variables are set correctly in Render
const SHOPEE_AUTH_HOST = process.env.SHOPEE_API_HOST_LIVE; // Use the same host as the API for auth
const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTNER_ID_LIVE;
const SHOPEE_API_KEY = process.env.SHOPEE_API_KEY_LIVE;

async function refreshShopeeAccessToken(connectionId, shop_id, refreshToken) {
  const path = '/api/v2/auth/access_token';
  const timestamp = Math.floor(Date.now() / 1000);

  // For refresh_token, the baseString for signature is partner_id + path + timestamp
  const baseStringForRefreshSign = `${SHOPEE_PARTNER_ID}${path}${timestamp}`;
  const sign = generateShopeeSignature({
    path: path,
    partner_id: SHOPEE_PARTNER_ID,
    partner_key: SHOPEE_API_KEY,
    timestamp: timestamp,
    // access_token and shop_id are NOT part of the signature for refresh_token endpoint
  }, baseStringForRefreshSign);

  const url = `${SHOPEE_AUTH_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;

  try {
    console.log(`🔄 [refreshShopeeAccessToken] Attempting token refresh for Shop ID: ${shop_id} (Connection ID: ${connectionId})...`);
    const response = await axios.post(
      url,
      {
        shop_id: Number(shop_id),
        partner_id: Number(SHOPEE_PARTNER_ID),
        refresh_token: refreshToken, // Use the provided refresh token
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    const { access_token: newAccessToken, expire_in, refresh_token: newRefreshToken } = response.data.response;

    // Store access_token_expires_at in additional_data as a timestamp or ISO string
    const newExpiresAt = new Date(Date.now() + expire_in * 1000);

    // Update the client_connections table
    const { data, error } = await supabase
      .from('client_connections') // Changed table name
      .update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken, // Always update the refresh token too, it can change
        additional_data: { access_token_expires_at: newExpiresAt.toISOString() }, // Store in additional_data
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId); // Use 'id' to target the specific connection

    if (error) {
      console.error('❌ [refreshShopeeAccessToken] Error updating Supabase with new tokens:', error.message);
      throw error;
    }

    console.log(`✅ [refreshShopeeAccessToken] Token refreshed for Shop ID: ${shop_id}. New Access Token: ${newAccessToken.substring(0, 10)}...`);
    return newAccessToken;

  } catch (error) {
    console.error('❌ [refreshShopeeAccessToken] Error refreshing Shopee token:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    throw error;
  }
}

module.exports = {
  // ... other auth functions
  refreshShopeeAccessToken,
};