// server.js
const express = require('express');
const app = express();
// A porta será definida pelo ambiente do Render (process.env.PORT) ou 3000 localmente
const port = process.env.PORT || 3000;

// Importar o roteador de autenticação
const authRoutes = require('./src/routes/authRoutes'); // Caminho correto se server.js está na raiz e authRoutes em src/routes

// Middleware para parsear JSON no corpo das requisições (para POST/PUT)
app.use(express.json());
// Middleware para parsear dados de formulário URL-encoded
app.use(express.urlencoded({ extended: true })); // Importante para dados de formulário

// *** MUITO IMPORTANTE: Montar o roteador authRoutes COM UM PREFIXO! ***
// Isso significa que todas as rotas definidas em authRoutes (ex: /shopee/callback)
// serão acessadas via /auth/shopee/callback.
// Esta linha deve vir ANTES de qualquer rota genérica como app.get('/')
app.use('/auth', authRoutes); // Adicionando o prefixo '/auth' para as rotas de autenticação

// Rota raiz - para verificar se o servidor está online e direcionar
app.get('/', (req, res) => {
    res.status(200).send('Servidor BI Marketplace Integrator rodando! Use /auth/shopee/authorize para iniciar a autenticação.');
});
console.log('-_teste para ver se seguiu dentro do server--');

// Middleware para lidar com rotas não encontradas (404)
app.use((req, res, next) => {
    res.status(404).send('Desculpe, a rota que você procura não foi encontrada.');
});
console.log('-_teste server passou 404--');

// Middleware de tratamento de erros (opcional, mas recomendado para produção)
app.use((err, req, res, next) => {
    console.error('❌ Erro inesperado no servidor:', err.stack);
    res.status(500).send('Algo deu errado no servidor!');
});
console.log('-_teste server passou 500 e vai iniciar servidor--');

// Iniciar o servidor
app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('---');
});