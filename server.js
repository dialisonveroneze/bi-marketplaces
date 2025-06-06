// server.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const authRoutes = require('./src/routes/authRoutes');
// >>> Adicione esta linha para importar as novas rotas de pedidos
const orderRoutes = require('./src/routes/orderRoutes'); // Caminho correto
// <<< Fim da adição

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', authRoutes);
// >>> Adicione esta linha para usar as novas rotas de pedidos com o prefixo '/api'
app.use('/api', orderRoutes);
// <<< Fim da adição

app.get('/', (req, res) => {
    res.status(200).send('Servidor BI Marketplace Integrator rodando! Use /auth/shopee/authorize para iniciar a autenticação.');
});
console.log('-_teste para ver se seguiu dentro do server--');

app.use((req, res, next) => {
    res.status(404).send('Desculpe, a rota que você procura não foi encontrada.');
});
console.log('-_teste server passou 404--');

app.use((err, req, res, next) => {
    console.error('❌ Erro inesperado no servidor:', err.stack);
    res.status(500).send('Algo deu errado no servidor!');
});
console.log('-_teste server passou 500 e vai iniciar servidor--');

app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('---');
});