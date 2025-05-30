// src/utils/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://YOUR_PROJECT_ID.supabase.co',
  'YOUR_SUPABASE_ANON_KEY'
);

module.exports = supabase;