require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Impor Supabase client (memastikan .env dimuat & client diinisialisasi)
require('./src/config/supabaseClient');

// Impor Middleware & Rute
const { errorHandler } = require('./src/middleware/errorHandler');
const { notFoundHandler } = require('./src/middleware/notFoundHandler');
const mangaRoutes = require('./src/routes/mangaRoutes');
const chapterRoutes = require('./src/routes/chapterRoutes');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');

const app = express();

// Middleware
app.use(cors()); // Aktifkan CORS
app.use(express.json()); // Parsing JSON
app.use(express.urlencoded({ extended: true })); // Parsing URL-encoded

// Rute Tes Sederhana
app.get('/', (req, res) => {
  res.send(`Backend KomikIn (Supabase) Port ${PORT} Siap!`);
});

// Gunakan Rute API Anda
app.use('/api/manga', mangaRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Handler 404 (Setelah semua rute API)
app.use(notFoundHandler);

// Error Handler Utama (Paling Bawah)
app.use(errorHandler);

// Tentukan Port
const PORT = process.env.PORT || 8081; // Pastikan menggunakan port yang tidak konflik

// Jalankan Server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});