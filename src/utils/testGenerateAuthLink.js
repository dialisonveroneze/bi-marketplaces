// testGenerateAuthLink.js
const generateAuthLink = require('./src/utils/generateAuthLink');

(async () => {
  try {
    const url = await generateAuthLink(1, 'shopee');
    console.log('URL de autorização:', url);
  } catch (err) {
    console.error('Erro ao gerar link:', err.message);
  }
})();
