const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("!!! FATAL ERROR: Pastikan SUPABASE_URL dan SUPABASE_SERVICE_KEY sudah diatur di file .env !!!");
  process.exit(1);
}

// Buat dan ekspor client Supabase menggunakan kunci service_role
const supabase = createClient(supabaseUrl, supabaseKey);

console.log(">>> Supabase client berhasil diinisialisasi.");
module.exports = supabase;
