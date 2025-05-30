// app.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const supabase = require('./src/utils/supabaseClient');

const fetchShopee     = require('./src/jobs/fetchShopeeOrders');
const normalizeShopee = require('./src/jobs/normalizeShopee');
const fetchMeli       = require('./src/jobs/fetchMeliOrders');
const normalizeMeli   = require('./src/jobs/normalizeMeli');

const app = express();
const PORT = 10000;

app.get('/', async (req, res) => {
  const { code, shop_id } = req.query;

  if (!code || !shop_id) {
    return res.send('BI Marketplaces API running!');
  }

  const { data, error } = await supabase
    .from('client_connections')
    .select('*')
    .eq('connection_name', 'shopee')
    .single();

  if (error || !data) {
    console.error('❌ Erro ao buscar credenciais Shopee no Supabase:', error);
    return res.status(500).send('Erro ao buscar dados');
  }

  const { partner_id, partner_key, id: connection_id } = data;
  const path = '/api/v2/auth/token/get';
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partner_id}${path}${timestamp}`;
  const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

  const url = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}`;

  console.log('📩 Callback recebido:', { code, shop_id });
  console.log('🌐 Endpoint usado:', url);

  try {
    const response = await axios.post(url, {
      code,
      shop_id: Number(shop_id),
      partner_id
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const { access_token, refresh_token } = response.data;

    await supabase
      .from('client_connections')
      .update({ access_token, refresh_token })
      .eq('id', connection_id);

    console.log('✅ Token salvo no Supabase com sucesso.');
    res.send('✅ Callback processado com sucesso. Veja o terminal.');
  } catch (err) {
    console.error('❌ Erro ao processar callback:', err.response?.data || err.message);
    res.status(500).send(`Erro: ${JSON.stringify(err.response?.data || err.message)}`);
  }
});

app.get('/my-ip', async (_, res) => {
  try {
    const r = await axios.get('https://ifconfig.me');
    res.send(`Meu IP público é: ${r.data}`);
  } catch (e) {
    res.status(500).send('Erro ao buscar IP: ' + e.message);
  }
});

async function runAll() {
  try {
    console.log('🕜 Iniciando ciclo de coleta e normalização:');
    await fetchShopee();
    await fetchMeli();
    await normalizeShopee();
    await normalizeMeli();
    console.log('✅ Ciclo concluído.');
  } catch (err) {
    console.error('❌ Erro no ciclo:', err);
  }
}

runAll();
setInterval(runAll, 1000 * 60 * 60);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});