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

// Importação da função de serviço de pedidos (mantém aqui)
const { fetchAndSaveShopeeOrders } = require('./src/services/shopeeOrderService');

// ===>> MOVA ESTA ROTA PARA CÁ, ANTES DO MIDDLEWARE 404 <<===
// Rota de teste temporária
app.get('/test-shopee-orders/:clientId', async (req, res) => {
	console.log(`\n--- [SERVER] Rota /test-shopee-orders/:shopId acionada ---`);
    const clientId = req.params.clientId; // Assumindo que você passa o ID do cliente na URL
    const idType = 'shop_id'; // Ou 'main_account_id' dependendo do seu setup no Supabase
    const id = "316070154"; // <<<<< CONFIRA SE ESTE SHOP_ID ESTÁ CORRETO E CORRESPONDE AO SEU TOKEN NO SUPABASE

    console.log(`Recebida requisição para testar busca de pedidos para client_id: ${clientId}, shop_id: ${id}`);
/*
    if (!id || id === "316070154") { // Adicionei uma verificação para o shop_id
        return res.status(400).json({ success: false, message: "Erro: 'shopIdToTest' não configurado ou inválido na rota /test-shopee-orders." });
    }
*/
    try {
        const orders = await fetchAndSaveShopeeOrders(id, idType, 'READY_TO_SHIP', 7);
		console.log(`[SERVER] Processo de busca de pedidos Shopee concluído com sucesso para Shop ID: ${id}`);
        res.json({ success: true, message: 'Pedidos buscados e salvos (se houver). Verifique os logs do servidor e o Supabase.', ordersCount: orders.length });
    } catch (error) {
        console.error('❌ Erro na rota de teste de pedidos Shopee:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar pedidos Shopee', error: error.message });
    }
});

// ===>> FIM DA ROTA MOVIDA <<===


// Middleware para lidar com rotas não encontradas (404)
// ESTE DEVE SER O ÚLTIMO MIDDLEWARE DE ROTA ANTES DO TRATAMENTO DE ERROS GENÉRICO
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