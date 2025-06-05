// src/utils/helpers.js

/**
 * Retorna o timestamp Unix atual em segundos.
 * @returns {number}
 */
function getCurrentUnixTimestamp() {
  return Math.floor(Date.now() / 1000);
}

// Adicione outras funções de utilidade aqui
// Ex: formatar datas, validar dados, etc.

module.exports = {
  getCurrentUnixTimestamp,
};