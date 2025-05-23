const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres.tqewvjwhbepuzwpptxer',
  password: '#BIMarketplaces1',
  host: 'aws-0-us-east-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
