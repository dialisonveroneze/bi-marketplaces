// server.js
const express = require('express');
const app = express();
// A porta será definida pelo ambiente do Render (process.env.PORT) ou 3000 localmente
const port = process.env.PORT || 3000;

// Importar o roteador de autenticação
const authRoutes = require('./src/routes/authRoutes'); // Certifique-se que o caminho está correto

// Middleware para parsear JSON no corpo das requisições
app.use(express.json());

// *** MUITO IMPORTANTE: Montar o roteador authRoutes AQUI! ***
// Esta linha deve vir ANTES de qualquer rota genérica como app.get('/')
// Assim, as rotas definidas em authRoutes (como /auth/shopee/callback)
// serão casadas antes da rota raiz mais geral.
app.use(authRoutes);

// Rota raiz - para verificar se o servidor está online e direcionar
app.get('/', (req, res) => {
    res.status(200).send('Servidor BI Marketplace Integrator rodando! Use /auth/shopee/callback para autorização.');
});

// Middleware para lidar com rotas não encontradas (404)
app.use((req, res, next) => {
    res.status(404).send('Desculpe, a rota que você procura não foi encontrada.');
});

// Middleware de tratamento de erros (opcional, mas recomendado para produção)
app.use((err, req, res, next) => {
    console.error('❌ Erro inesperado no servidor:', err.stack);
    res.status(500).send('Algo deu errado no servidor!');
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('---');
});