require('dotenv').config();
const { Pool } = require('pg');
const fetchOrders = require('./src/jobs/fetchOrders');

console.log('Iniciando aplicação...');

fetchOrders();
