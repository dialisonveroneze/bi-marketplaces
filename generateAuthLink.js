const crypto = require('crypto');

function generateShopeeAuthLink() {
  const partner_id = '1279994';
  const partner_key = 'SUA_PARTNER_KEY'; // troque pela sua partner key real
  const redirect = encodeURIComponent('https://bi-marketplaces.onrender.com/callback');
  const path = '/api/v2/shop/auth_partner';

  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partner_id}${path}${timestamp}`;
  
  const sign = crypto.createHmac('sha256', partner_key)
                     .update(baseString)
                     .digest('hex');

  return `https://partner.test-stable.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&redirect=${redirect}`;
}

console.log(generateShopeeAuthLink());
