const generateShopeeAuthLink = require('./src/utils/generateAuthLink');

(async () => {
  try {
    const url = await generateShopeeAuthLink(1);
    console.log('URL de autorização:', url);
  } catch (err) {
    console.error('Erro ao gerar link:', err.message);
  }
})();
