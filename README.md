your-project/
├── src/
│   ├── routes/
│   │   ├── authRoutes.js         # Lida com autenticação (OAuth, callback) e geração do link de autorização.
│   │   └── shopeeApiRoutes.js    # Lida com chamadas à API da Shopee (pedidos, produtos, etc.).
│   └── services/
│       ├── shopeeAuthService.js  # Funções para obter/refrescar tokens.
│       └── shopeeOrderService.js # Funções para buscar pedidos da Shopee e normalizá-los.
│   └── config/
│       ├── supabase.js           # Inicialização do Supabase.
│       └── shopeeConfig.js       # Carrega e valida variáveis de ambiente da Shopee.
├── .env                          # Variáveis de ambiente.
└── server.js                     # Ponto de entrada da aplicação Express.


Para funcionar a auth
SHOPEE_API_HOST_LIVE = https://partner.shopeemobile.com 