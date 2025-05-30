// app.js

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const fetchShopeeOrders = require('./src/jobs/fetchShopeeOrders');
const normalizeShopee = require('./src/jobs/normalizeShopee');
const fetchMeli = require('./src/jobs/fetchMeliOrders');
const normalizeMeli = require('./src/jobs/normalizeMeli');

const app = express();
const PORT = process.env.PORT || 10000;

// Configuração do Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Callback Shopee para atualizar tokens
app.get('/', async (req, res) => {
  const { code, shop_id } = req.query;

  if (!code || !shop_id) {
    return res.send('🚀 Servidor rodando na porta ' + PORT);
  }

  try {
    // Buscar credenciais no banco
    const { data, error } = await supabase
      .from('client_connections')
      .select('partner_id, partner_key')
      .eq('connection_name', 'shopee')
      .single();

    if (error || !data) {
      console.error('Erro ao buscar credenciais:', error);
      return res.status(500).send('Erro ao buscar credenciais Shopee.');
    }

    const partner_id = data.partner_id;
    const partner_key = data.partner_key;
    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');
    const url = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}`;

    console.log('🌐 URL de autenticação:', url);

    const response = await axios.post(
      url,
      {
        code,
        shop_id: Number(shop_id),
        partner_id: Number(partner_id)
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('✅ Token recebido com sucesso:', response.data);

    // Atualiza tokens no banco
    await supabase
      .from('client_connections')
      .update({
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token
      })
      .eq('connection_name', 'shopee');

    res.send('✅ Callback processado com sucesso!');
  } catch (err) {
    console.error('❌ Erro no callback:', err);
    res.status(500).send(`Erro ao processar callback: ${err.message}`);
  }
});

// Pipeline de coleta e normalização
async function runAll() {
  try {
    console.log('🕜 Iniciando ciclo de coleta e normalização:');
    console.log('› Fetch Shopee');
    await fetchShopeeOrders();
    console.log('› Fetch Mercado Livre');
    await fetchMeli();
    console.log('› Normalize Shopee');
    await normalizeShopee();
    console.log('› Normalize Mercado Livre');
    await normalizeMeli();
    console.log('✅ Ciclo concluído.');
  } catch (err) {
    console.error('❌ Erro no ciclo:', err);
  }
}

// Executa ao iniciar
runAll();

// Agenda execução a cada 1 hora
setInterval(runAll, 1000 * 60 * 60);

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});