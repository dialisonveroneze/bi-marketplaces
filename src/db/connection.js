const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  host: 'db.tqewvjwhbepuzwpptxer.supabase.co',
  family: 4 // <-- Força IPv4
});

module.exports = pool;
