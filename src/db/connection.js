const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },  // ✅ Necessário para Supabase
    host: 'db.tqewvjwhbepuzwpptxer.supabase.co',  // ✅ Força host
    port: 5432,  // ✅ Força porta
});
