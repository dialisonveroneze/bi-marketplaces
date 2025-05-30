// app.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 10000;

// Configurações Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Função para buscar configurações da Shopee no banco de dados
async function getShopeeConfig() {
  const { data, error } = await supabase
    .from('config_shopee')
    .select('*')
    .single();
  if (error) throw new Error('Erro ao buscar configurações da Shopee: ' + error.message);
  return data;
}

// Rota principal
app.get('/', async (req, res) => {
  const { code, shop_id } = req.query;

  if (!code || !shop_id) {
    return res.send('✅ BI Marketplaces API running!');
  }

  try {
    const config = await getShopeeConfig();
    const partner_id = config.partner_id;
    const partner_key = config.partner_key;

    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');
    const url = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}`;

    console.log('🔗 URL Shopee Token:', url);

    const response = await axios.post(
      url,
      { code, shop_id: Number(shop_id), partner_id },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('✅ Token recebido:', response.data);

    await supabase
      .from('config_shopee')
      .update({
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        token_expire: new Date(Date.now() + response.data.expire_in * 1000)
      })
      .eq('id', config.id);

    res.send('✅ Callback processado com sucesso. Veja o terminal.');
  } catch (error) {
    console.error('❌ Erro no callback:', error.response?.data || error.message);
    res.status(500).send(`Erro ao processar callback: ${JSON.stringify(error.response?.data || error.message)}`);
  }
});

// Healthcheck
app.get('/my-ip', async (req, res) => {
  try {
    const resp = await axios.get('https://ifconfig.me');
    res.send(`Meu IP público é: ${resp.data}`);
  } catch (err) {
    res.status(500).send('Erro ao buscar IP: ' + err.message);
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});