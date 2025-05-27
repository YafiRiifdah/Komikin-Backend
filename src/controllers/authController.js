const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');

const register = async (req, res, next) => {
    try {
        const { email, password, username } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email dan password dibutuhkan.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password minimal 6 karakter.' });
        }

        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('email')
            .eq('email', email)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error("Supabase check error:", checkError);
            throw checkError;
        }
        if (existingUser) {
            return res.status(409).json({ message: 'Email sudah terdaftar.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{ email, password_hash, username }])
            .select('id, email, username, created_at, profile_image_url')
            .single();

        if (insertError) {
            console.error("Supabase insert error:", insertError);
            throw new Error("Gagal mendaftarkan pengguna.");
        }

        res.status(201).json({
            message: 'Registrasi berhasil!',
            user: newUser,
        });
    } catch (error) {
        console.error("Register error:", error);
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email dan password dibutuhkan.' });
        }

        const { data: user, error: findError } = await supabase
            .from('users')
            .select('id, email, password_hash, username, profile_image_url')
            .eq('email', email)
            .single();

        if (findError && findError.code !== 'PGRST116') {
             console.error("Supabase find error:", findError);
             throw findError;
        }
        if (!user) {
            return res.status(401).json({ message: 'Kombinasi email/password salah.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Kombinasi email/password salah.' });
        }

        const payload = { userId: user.id, email: user.email };
        if (!process.env.JWT_SECRET) {
            console.error("FATAL ERROR: JWT_SECRET tidak ditemukan di .env");
            return res.status(500).json({ message: "Kesalahan konfigurasi server." });
        }
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: 'Login berhasil!',
            token: token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                profile_image_url: user.profile_image_url
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        // Logout utama ditangani client dengan menghapus token.
        // Endpoint ini bisa untuk logging atau blacklist token di masa depan.
        console.log(`User ${req.user ? req.user.email : '(Token tidak diverifikasi)'} melakukan logout.`);
        res.status(200).json({ message: 'Logout berhasil. Silakan hapus token di sisi client.' });
    } catch (error) {
        console.error("Logout error:", error);
        next(error);
    }
};

module.exports = {
    register,
    login,
    logout,
};