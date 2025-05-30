// app.js
    }

    const { partner_id, partner_key } = data;
    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partner_id}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', partner_key).update(baseString).digest('hex');

    const url = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}`;

    console.log('📩 Callback recebido:', { code, shop_id });
    console.log('🌐 Endpoint usado:', url);

    const response = await axios.post(
      url,
      {
        code,
        shop_id: Number(shop_id),
        partner_id
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('✅ Token recebido com sucesso:', response.data);
    res.send('✅ Callback processado com sucesso. Veja o terminal.');
  } catch (error) {
    console.error('❌ Erro ao processar callback:', error.response?.data || error.message);
    res.status(500).send(`Erro ao processar callback: Tokens não retornados pela Shopee. Resposta: ${JSON.stringify(error.response?.data || error.message)}`);
  }
});

// 🔄 Pipeline de coleta e normalização
async function runAll() {
  try {
    console.log('🕜 Iniciando ciclo de coleta e normalização:');
    console.log('› Fetch Shopee');
    await fetchShopee();
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

// Executa a cada 1 hora
setInterval(runAll, 1000 * 60 * 60);

// Inicia servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});