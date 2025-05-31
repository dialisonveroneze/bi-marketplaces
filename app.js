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

// Callback Shopee para receber tokens e salvar no banco
app.get('/', async (req, res) => {
  const { code, shop_id } = req.query;

  if (!code || !shop_id) {
    console.log(`[callback Shopee] Sem code ou shop_id, apenas status do servidor.`);
    return res.send('🚀 Servidor rodando na porta ' + PORT);
  }

  try {
    console.log(`[callback Shopee] Iniciando processo com code=${code} e shop_id=${shop_id}`);

    // Buscar dados adicionais para pegar partner_id e partner_key
    const { data, error } = await supabase
      .from('client_connections')
      .select('additional_data')
      .eq('connection_name', 'shopee')
      .single();

    if (error || !data) {
      console.error('[callback Shopee] Erro ao buscar additional_data:', error);
      return res.status(500).send('Erro ao buscar dados de conexão Shopee.');
    }

    let additionalData = data.additional_data;
    // Caso additional_data venha como string, parsear
    if (typeof additionalData === 'string') {
      additionalData = JSON.parse(additionalData);
    }
    const partner_id = additionalData.live.partner_id;
    const partner_key = additionalData.live.partner_key;

    if (!partner_id || !partner_key) {
      console.error('[callback Shopee] partner_id ou partner_key ausentes em additional_data');
      return res.status(500).send('Dados essenciais ausentes na configuração Shopee.');
    }

    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');
    const url = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}`;

    console.log('[callback Shopee] URL de autenticação gerada:', url);

    const response = await axios.post(
      url,
      {
        code,
        shop_id: Number(shop_id),
        partner_id: Number(partner_id),
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('[callback Shopee] Resposta do token:', response.data);

    const { access_token, refresh_token } = response.data;

    if (!access_token) {
      console.error('[callback Shopee] access_token ausente na resposta da Shopee');
      return res.status(500).send('Access token ausente na resposta da Shopee.');
    }

    // Atualiza os tokens no banco, mantendo additional_data intacto
    const { error: updateError } = await supabase
      .from('client_connections')
      .update({
        access_token,
        refresh_token
      })
      .eq('connection_name', 'shopee');

    if (updateError) {
      console.error('[callback Shopee] Erro ao atualizar tokens no banco:', updateError);
      return res.status(500).send('Erro ao salvar tokens no banco.');
    }

    console.log('[callback Shopee] Tokens atualizados com sucesso no banco');
    res.send('✅ Callback processado com sucesso e tokens atualizados!');
  } catch (err) {
    console.error('[callback Shopee] Erro inesperado:', err);
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
setInterval(runAll, 1000 * 60 * 60); // Executa a cada 1 hora

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});