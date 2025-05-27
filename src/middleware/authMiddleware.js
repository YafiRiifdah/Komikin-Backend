const jwt = require('jsonwebtoken');
// const supabase = require('../config/supabaseClient'); // Tidak perlu Supabase di sini untuk verifikasi token dasar

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Simpan ID user dan email ke req agar bisa dipakai controller
            req.user = {
                id: decoded.userId,
                email: decoded.email
                // Anda bisa mengambil data user lengkap dari DB di sini jika perlu,
                // tapi untuk banyak kasus, userId dari token sudah cukup.
            };
            next();
        } catch (error) {
            console.error('Token verification failed:', error.message);
            return res.status(401).json({ message: 'Tidak terotentikasi, token gagal.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Tidak terotentikasi, tidak ada token.' });
    }
};

module.exports = { protect };