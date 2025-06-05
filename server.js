// server.js
const express = require('express');
const cors = require('cors'); // Recomendo adicionar CORS para evitar problemas de cross-origin
require('dotenv').config(); // Carrega as variáveis de ambiente do .env (para desenvolvimento local)

const app = express();
const PORT = process.env.PORT || 10000; // Use a porta que o Render atribui ou 10000 como fallback

// Importar as rotas
const authRoutes = require('./src/routes/authRoutes');

// Middlewares
app.use(express.json());
app.use(cors()); // Habilita CORS para todas as rotas

// --- Configurar rotas (Ajustado) ---
// A Shopee redireciona para /auth/shopee/callback
// Se authRoutes.js já define router.get('/auth/shopee/callback', ...),
// então basta usar '/' aqui para que o caminho completo seja respeitado.
app.use('/auth/shopee/callback', authRoutes); 

// Rota básica para testar se o servidor está funcionando
// Esta rota responderá apenas se nenhuma rota em authRoutes.js com '/' for acionada antes.
// Por exemplo, se authRoutes.js já tiver um 'router.get('/', ...)', esta rota aqui não será atingida.
app.get('/', (req, res) => {
    res.status(200).send('Servidor BI Marketplace Integrator rodando! Utilize /auth/shopee/callback para autorização da Shopee.');
});


// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('---');
});