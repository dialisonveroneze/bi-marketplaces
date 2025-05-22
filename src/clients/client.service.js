const pool = require('../db/connection');

async function getClients() {
    const res = await pool.query('SELECT * FROM clients');
    return res.rows;
}

module.exports = {
    getClients
};
