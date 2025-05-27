const express = require('express');
const app = express();

app.get('/callback', (req, res) => {
  console.log('Recebido callback:', req.query);
  res.status(200).send('Callback recebido com sucesso!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
