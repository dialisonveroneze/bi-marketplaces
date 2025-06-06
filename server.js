// server.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Verificar variáveis de ambiente da Shopee ao iniciar
if (!process.env.SHOPEE_PARTNER_ID || !process.env.SHOPEE_PARTNER_KEY || !process.env.SHOPEE_REDIRECT_URL) {
    console.error('❌ ERRO: Uma ou mais variáveis de ambiente da Shopee não estão configuradas. Por favor, verifique .env ou as configurações do Render.');
    // Considere lançar um erro ou sair do processo aqui se as variáveis forem críticas para o início do servidor.
} else {
    console.log('--- Todas as variáveis de ambiente da Shopee estão configuradas corretamente. ---');
}

// Importar os roteadores
const authRoutes = require('./src/routes/authRoutes');
// NOVO: Importar o roteador de pedidos
const orderRoutes = require('./src/routes/orderRoutes'); // Caminho correto

// Middleware para parsear JSON e dados de formulário
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Montar os roteadores com prefixos
app.use('/auth', authRoutes);
// NOVO: Montar o roteador de pedidos
app.use('/api', orderRoutes);

// Rota raiz - para verificar se o servidor está online
app.get('/', (req, res) => {
    res.status(200).send('Servidor BI Marketplace Integrator rodando! Use /auth/shopee/authorize para iniciar a autenticação.');
});
console.log('-_teste para ver se seguiu dentro do server--');

// Middleware para lidar com rotas não encontradas (404)
app.use((req, res, next) => {
    res.status(404).send('Desculpe, a rota que você procura não foi encontrada.');
});
console.log('-_teste server passou 404--');

// Middleware de tratamento de erros
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