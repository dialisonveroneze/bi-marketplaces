// src/config/shopeeConfig.js

const SHOPEE_PARTNER_ID_LIVE = process.env.SHOPEE_PARTNER_ID_LIVE ? process.env.SHOPEE_PARTNER_ID_LIVE.trim() : undefined;
const SHOPEE_API_KEY_LIVE = process.env.SHOPEE_API_KEY_LIVE ? process.env.SHOPEE_API_KEY_LIVE.trim() : undefined;
const SHOPEE_AUTH_HOST_LIVE = process.env.SHOPEE_AUTH_HOST_LIVE ? process.env.SHOPEE_AUTH_HOST_LIVE.trim() : undefined;
const SHOPEE_API_HOST_LIVE = process.env.SHOPEE_API_HOST_LIVE ? process.env.SHOPEE_API_HOST_LIVE.trim() : undefined;
const SHOPEE_REDIRECT_URL_LIVE = process.env.SHOPEE_REDIRECT_URL_LIVE ? process.env.SHOPEE_REDIRECT_URL_LIVE.trim() : undefined;

// Validação para garantir que todas as variáveis da Shopee estão presentes
let shopeeConfigOk = true;
if (!SHOPEE_PARTNER_ID_LIVE) {
    console.error("Erro: SHOPEE_PARTNER_ID_LIVE não está configurado.");
    shopeeConfigOk = false;
}
if (!SHOPEE_API_KEY_LIVE) {
    console.error("Erro: SHOPEE_API_KEY_LIVE não está configurado.");
    shopeeConfigOk = false;
}
if (!SHOPEE_AUTH_HOST_LIVE) {
    console.error("Erro: SHOPEE_AUTH_HOST_LIVE não está configurado.");
    shopeeConfigOk = false;
}
if (!SHOPEE_API_HOST_LIVE) {
    console.error("Erro: SHOPEE_API_HOST_LIVE não está configurado.");
    shopeeConfigOk = false;
}
if (!SHOPEE_REDIRECT_URL_LIVE) {
    console.error("Erro: SHOPEE_REDIRECT_URL_LIVE não está configurado.");
    shopeeConfigOk = false;
}

if (!shopeeConfigOk) {
    console.error("--- ERRO CRÍTICO: Variáveis de ambiente da Shopee não estão configuradas corretamente. ---");
    process.exit(1);
} else {
    console.log("--- Todas as variáveis de ambiente da Shopee estão configuradas corretamente. ---");
}

module.exports = {
    SHOPEE_PARTNER_ID_LIVE: Number(SHOPEE_PARTNER_ID_LIVE),
    SHOPEE_API_KEY_LIVE,
    SHOPEE_AUTH_HOST_LIVE,
    SHOPEE_API_HOST_LIVE,
    SHOPEE_REDIRECT_URL_LIVE,
};