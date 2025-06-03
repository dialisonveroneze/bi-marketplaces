// server.js (ou app.js)
require('dotenv').config(); // Carrega as variáveis de ambiente do .env

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Importar as rotas
const authRoutes = require('./src/routes/authRoutes');
// const apiRoutes = require('./src/routes/apiRoutes'); // Se for ter outras rotas de API

// Middleware para parsear JSON no corpo das requisições
app.use(express.json());

// Configurar rotas
app.use('/auth', authRoutes); // Ex: /auth/shopee/callback
// app.use('/api', apiRoutes); // Ex: /api/shopee/orders

// Rota básica para testar se o servidor está funcionando
app.get('/', (req, res) => {
  res.send('Servidor BI Marketplace Integrator rodando!');
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('---');
});