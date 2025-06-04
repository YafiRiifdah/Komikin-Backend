const supabase = require('../config/supabaseClient');
const mangadexService = require('../services/mangadexService');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const net = require('net');

// Force load dotenv
require('dotenv').config();

// Konfigurasi Email - TEMPORARY: Pakai Ethereal untuk bypass network block
const createTransporter = async () => {
    // Coba Gmail dulu
    try {
        const gmailTransporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000  // 10 detik timeout
        });
        
        await gmailTransporter.verify();
        console.log('✅ Gmail SMTP ready');
        return gmailTransporter;
    } catch (error) {
        console.log('❌ Gmail SMTP blocked, using Ethereal fallback');
        
        // Fallback ke Ethereal (free testing email)
        const testAccount = await nodemailer.createTestAccount();
        console.log('📧 Ethereal Test Account:', testAccount.user);
        
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
    }
};

// Initialize transporter
let transporter;
createTransporter().then(t => {
    transporter = t;
}).catch(error => {
    console.error('❌ All SMTP failed:', error.message);
});

// Helper function untuk test port
function testPort(host, port, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        
        socket.setTimeout(timeout);
        
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        
        socket.on('error', (err) => {
            socket.destroy();
            resolve(false);
        });
        
        socket.connect(port, host);
    });
}

// Generate OTP 6 digit
const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
};

// TEST ENDPOINT: Test SMTP Connection
const testSMTPConnection = async (req, res, next) => {
    const testConnections = [
        { host: 'smtp.gmail.com', port: 587, name: 'Gmail Port 587' },
        { host: 'smtp.gmail.com', port: 465, name: 'Gmail Port 465' },
        { host: '8.8.8.8', port: 53, name: 'DNS Google' }
    ];
    
    const results = [];
    
    for (const test of testConnections) {
        try {
            const isOpen = await testPort(test.host, test.port);
            results.push({
                name: test.name,
                host: test.host,
                port: test.port,
                status: isOpen ? '✅ OPEN' : '❌ BLOCKED',
                accessible: isOpen
            });
        } catch (error) {
            results.push({
                name: test.name,
                host: test.host,
                port: test.port,
                status: '❌ ERROR',
                error: error.message,
                accessible: false
            });
        }
    }
    
    res.json({
        message: 'Network connectivity test results',
        results,
        recommendation: results.find(r => r.accessible) ? 
            'At least one SMTP port is accessible' : 
            'All SMTP ports blocked - check firewall/ISP'
    });
};

// TEST ENDPOINT: Test Email Authentication (PUBLIC - No auth required)
const testEmailAuth = async (req, res, next) => {
    try {
        console.log('Testing email configuration...');
        console.log('EMAIL_USER:', process.env.EMAIL_USER);
        console.log('EMAIL_PASS length:', process.env.EMAIL_PASS?.length);
        
        // Test koneksi transporter
        await transporter.verify();
        
        res.json({
            success: true,
            message: 'SMTP configuration valid',
            user: process.env.EMAIL_USER,
            config: {
                host: 'smtp.gmail.com',
                port: 587,
                secure: false
            }
        });
    } catch (error) {
        console.error('SMTP Test Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code,
            user: process.env.EMAIL_USER
        });
    }
};

// Mengirim OTP ke Email untuk Reset Password
const sendPasswordResetOTP = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        // DEBUG: Log environment variables
        console.log('=== EMAIL DEBUG ===');
        console.log('EMAIL_USER:', process.env.EMAIL_USER);
        console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
        console.log('EMAIL_PASS length:', process.env.EMAIL_PASS?.length);
        console.log('SMTP Config: smtp.gmail.com:587');
        console.log('==================');
        
        if (!email) {
            return res.status(400).json({ message: 'Email dibutuhkan.' });
        }

        // Cek apakah email ada di database
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('id, email, username')
            .eq('email', email.toLowerCase())
            .single();

        if (findError || !user) {
            return res.status(404).json({ message: 'Email tidak ditemukan.' });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit dari sekarang

        // Simpan OTP ke database (buat tabel otp_codes jika belum ada)
        const { error: insertError } = await supabase
            .from('otp_codes')
            .upsert({
                user_id: user.id,
                email: email.toLowerCase(),
                otp_code: otp,
                purpose: 'password_reset',
                expires_at: expiresAt.toISOString(),
                is_used: false,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,purpose'
            });

        if (insertError) {
            console.error("Error saving OTP:", insertError);
            throw insertError;
        }

        // Kirim email OTP
        const mailOptions = {
            from: `"KomikIn Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Kode Verifikasi Reset Password - KomikIn',  // Hilangkan emoji
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">🎌 KomikIn</h1>
                        <p style="color: #e8f4fd; margin: 10px 0 0 0; font-size: 16px;">Reset Password Account</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0; font-size: 20px;">Halo, Manga Lover! 👋</h2>
                        
                        <p style="color: #555; line-height: 1.6; font-size: 16px;">
                            Kami menerima permintaan untuk mereset password akun KomikIn Anda. 
                            Gunakan kode verifikasi berikut untuk melanjutkan:
                        </p>
                        
                        <!-- OTP Code Box -->
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; text-align: center; margin: 30px 0; border-radius: 10px; border: 3px dashed #667eea;">
                            <p style="color: white; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">KODE VERIFIKASI</p>
                            <h1 style="color: #ffffff; font-size: 36px; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</h1>
                        </div>
                        
                        <!-- Important Info -->
                        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; color: #856404; font-size: 14px;">
                                ⏰ <strong>Kode ini berlaku selama 10 menit</strong> sejak email ini dikirim.
                            </p>
                        </div>
                        
                        <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; color: #0c5460; font-size: 14px;">
                                🔒 <strong>Keamanan:</strong> Jangan bagikan kode ini kepada siapapun. 
                                Tim KomikIn tidak akan pernah meminta kode verifikasi Anda.
                            </p>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; line-height: 1.5;">
                            Jika Anda tidak meminta reset password, abaikan email ini. 
                            Akun Anda tetap aman dan tidak ada perubahan yang dibuat.
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
                        <p style="margin: 0;">📧 Email otomatis dari sistem KomikIn</p>
                        <p style="margin: 5px 0 0 0;">© 2024 KomikIn - Platform Baca Manga Terbaik</p>
                        <div style="margin-top: 15px;">
                            <span style="margin: 0 10px;">🌟</span>
                            <span style="color: #667eea; font-weight: bold;">Happy Reading!</span>
                            <span style="margin: 0 10px;">🌟</span>
                        </div>
                    </div>
                </div>
            `
        };

        console.log('Attempting to send email to:', email);
        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully');
        
        // Jika pakai Ethereal, tampilkan preview URL
        if (result.messageId && result.messageId.includes('ethereal')) {
            console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(result));
        }

        res.status(200).json({ 
            message: 'Kode OTP telah dikirim ke email Anda.',
            email: email 
        });

    } catch (error) {
        console.error("Send OTP error:", error);
        console.error("ERROR STACK:", error);
        next(error);
    }
};

// Verifikasi OTP untuk Reset Password
const verifyPasswordResetOTP = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email dan kode OTP dibutuhkan.' });
        }

        // Cari OTP yang valid
        const { data: otpRecord, error: findError } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('otp_code', otp)
            .eq('purpose', 'password_reset')
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (findError || !otpRecord) {
            return res.status(400).json({ 
                message: 'Kode OTP tidak valid atau sudah kadaluarsa.' 
            });
        }

        // Mark OTP sebagai terverifikasi (tapi belum digunakan)
        const { error: updateError } = await supabase
            .from('otp_codes')
            .update({ 
                verified_at: new Date().toISOString() 
            })
            .eq('id', otpRecord.id);

        if (updateError) throw updateError;

        res.status(200).json({ 
            message: 'Kode OTP berhasil diverifikasi. Silakan masukkan password baru.',
            token: otpRecord.id, // Gunakan ID sebagai token sementara
            email: email
        });

    } catch (error) {
        console.error("Verify OTP error:", error);
        next(error);
    }
};

// Reset Password dengan OTP (menggantikan updatePassword lama)
const resetPasswordWithOTP = async (req, res, next) => {
    try {
        const { email, token, newPassword } = req.body;

        if (!email || !token || !newPassword) {
            return res.status(400).json({ 
                message: 'Email, token, dan password baru dibutuhkan.' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                message: 'Password baru minimal 6 karakter.' 
            });
        }

        // Verifikasi token OTP
        const { data: otpRecord, error: findError } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('id', token)
            .eq('email', email.toLowerCase())
            .eq('purpose', 'password_reset')
            .eq('is_used', false)
            .not('verified_at', 'is', null)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (findError || !otpRecord) {
            return res.status(400).json({ 
                message: 'Token tidak valid atau sudah kadaluarsa.' 
            });
        }

        // Hash password baru
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        // Update password user
        const { error: updateError } = await supabase
            .from('users')
            .update({ 
                password_hash: newPasswordHash,
                updated_at: new Date().toISOString()
            })
            .eq('id', otpRecord.user_id);

        if (updateError) throw updateError;

        // Mark OTP sebagai sudah digunakan
        await supabase
            .from('otp_codes')
            .update({ 
                is_used: true,
                used_at: new Date().toISOString()
            })
            .eq('id', otpRecord.id);

        res.status(200).json({ 
            message: 'Password berhasil direset!' 
        });

    } catch (error) {
        console.error("Reset password error:", error);
        next(error);
    }
};

// Update Password (untuk user yang sudah login - tetap pakai current password)
const updatePassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                message: 'Password saat ini dan password baru dibutuhkan.' 
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ 
                message: 'Password baru minimal 6 karakter.' 
            });
        }
        
        const { data: user, error: findError } = await supabase
            .from('users').select('password_hash').eq('id', userId).single();
            
        if (findError) throw findError;
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });
        
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Password saat ini salah.' });
        
        const salt = await bcrypt.genSalt(10);
        const new_password_hash = await bcrypt.hash(newPassword, salt);
        
        const { error: updateError } = await supabase
            .from('users').update({ password_hash: new_password_hash }).eq('id', userId);
            
        if (updateError) throw updateError;
        
        res.status(200).json({ message: 'Password berhasil diperbarui.' });
    } catch (error) {
        console.error("Update password error:", error);
        next(error);
    }
};

// Menambah Bookmark
const addBookmark = async (req, res, next) => {
    try {
        const { mangaId } = req.body;
        const userId = req.user.id;

        if (!mangaId) {
            return res.status(400).json({ message: 'mangaId dibutuhkan.' });
        }

        const { data: existing, error: checkErr } = await supabase
            .from('bookmarks')
            .select('*')
            .eq('user_id', userId)
            .eq('manga_id', mangaId)
            .single();

        if (existing) {
            return res.status(200).json({ message: 'Manga sudah ada di bookmark.', bookmark: existing });
        }
        if (checkErr && checkErr.code !== 'PGRST116') {
            console.error("Supabase check bookmark error:", checkErr);
            throw checkErr;
        }

        const { data: newBookmark, error: insertError } = await supabase
            .from('bookmarks')
            .insert([{ user_id: userId, manga_id: mangaId }])
            .select('*')
            .single();

        if (insertError) {
            console.error("Supabase insert bookmark error:", insertError);
            throw insertError;
        }
        res.status(201).json({ message: 'Bookmark berhasil ditambahkan!', bookmark: newBookmark });
    } catch (error) {
        console.error("Add bookmark error:", error);
        next(error);
    }
};

// Mengambil Semua Bookmark User (dengan Detail Manga)
const getBookmarks = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const { count: totalItems, error: countError } = await supabase
            .from('bookmarks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (countError) throw countError;
        if (totalItems === 0) {
            return res.json({ message: "Tidak ada bookmark.", data: [], pagination: { currentPage: 1, totalPages: 0, itemsPerPage: limit, totalItems: 0 } });
        }
        
        const totalPages = Math.ceil(totalItems / limit);
        const { data: bookmarksFromSupabase, error: supabaseError } = await supabase
            .from('bookmarks')
            .select('manga_id, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (supabaseError) throw supabaseError;
        if (!bookmarksFromSupabase || bookmarksFromSupabase.length === 0) {
            return res.status(200).json({ message: "Bookmark untuk halaman ini kosong.", data: [], pagination: { currentPage: page, totalPages: totalPages, itemsPerPage: limit, totalItems: totalItems } });
        }

        const mangaIds = [...new Set(bookmarksFromSupabase.map(bm => bm.manga_id))];
        let mangaDetailsMap = {};
        if (mangaIds.length > 0) {
            try {
                const mangaDetailsData = await mangadexService.searchManga({ 'ids[]': mangaIds, limit: mangaIds.length });
                mangaDetailsData.results.forEach(manga => { mangaDetailsMap[manga.id] = manga; });
            } catch (mangadexErr) { console.error("Error fetching manga details for bookmarks:", mangadexErr.message); }
        }

        const enrichedBookmarks = bookmarksFromSupabase.map(bm => {
            const details = mangaDetailsMap[bm.manga_id];
            return { ...bm, title: details ? details.title : 'N/A', coverUrl: details ? details.coverUrl : null, author: details ? details.author : 'N/A', status: details ? details.status : 'N/A' };
        });

        res.status(200).json({ message: "Bookmark berhasil diambil.", data: enrichedBookmarks, pagination: { currentPage: page, totalPages: totalPages, itemsPerPage: limit, totalItems: totalItems } });
    } catch (error) {
        console.error("Get bookmarks error:", error);
        next(error);
    }
};

// Menghapus Bookmark
const deleteBookmark = async (req, res, next) => {
    try {
        const { mangaId } = req.params;
        const userId = req.user.id;
        console.log(`DEBUG: Mencoba menghapus bookmark - User ID: [${userId}], Manga ID: [${mangaId}]`);

        const { data, error } = await supabase
            .from('bookmarks')
            .delete()
            .match({ user_id: userId, manga_id: mangaId })
            .select();

        console.log("DEBUG: Respons Supabase Delete -> Error:", error, "Data (dihapus):", data);
        if (error) throw error;
        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Bookmark tidak ditemukan untuk dihapus.' });
        }
        res.status(200).json({ message: 'Bookmark berhasil dihapus.', deleted: data });
    } catch (error) {
        console.error("Delete bookmark error:", error);
        next(error);
    }
};

// Menambah atau Memperbarui History
const addHistory = async (req, res, next) => {
    try {
        const { mangaId, chapterId, lastPage } = req.body;
        const userId = req.user.id;
        if (!mangaId || !chapterId) {
            return res.status(400).json({ message: 'mangaId dan chapterId dibutuhkan.' });
        }
        const { data, error } = await supabase
            .from('history')
            .upsert({ user_id: userId, manga_id: mangaId, chapter_id: chapterId, last_page: Number(lastPage) || 0, updated_at: new Date().toISOString() }, { onConflict: 'user_id, chapter_id' })
            .select('*').single();
        if (error) throw error;
        res.status(200).json({ message: 'History berhasil diperbarui!', history: data });
    } catch (error) {
        console.error("Add/Update history error:", error);
        next(error);
    }
};

// Mengambil Semua History User (dengan Detail Manga)
const getHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const { count: totalItems, error: countError } = await supabase
            .from('history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
        
        if (countError) throw countError;
        if (totalItems === 0) {
             return res.json({ message: "Tidak ada history.", data: [], pagination: { currentPage: 1, totalPages: 0, itemsPerPage: limit, totalItems: 0 } });
        }

        const totalPages = Math.ceil(totalItems / limit);
        const { data: historyFromSupabase, error: supabaseError } = await supabase
            .from('history')
            .select('manga_id, chapter_id, last_page, updated_at')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (supabaseError) throw supabaseError;
        if (!historyFromSupabase || historyFromSupabase.length === 0) {
            return res.status(200).json({ message: "History untuk halaman ini kosong.", data: [], pagination: { currentPage: page, totalPages: totalPages, itemsPerPage: limit, totalItems: totalItems } });
        }

        const mangaIds = [...new Set(historyFromSupabase.map(h => h.manga_id))];
        let mangaDetailsMap = {};
        if (mangaIds.length > 0) {
             try {
                const mangaDetailsData = await mangadexService.searchManga({ 'ids[]': mangaIds, limit: mangaIds.length });
                mangaDetailsData.results.forEach(manga => { mangaDetailsMap[manga.id] = manga; });
            } catch (mangadexErr) { console.error("Error fetching manga details for history:", mangadxErr.message); }
        }
        const enrichedHistory = historyFromSupabase.map(h => {
            const details = mangaDetailsMap[h.manga_id];
            return { ...h, mangaTitle: details ? details.title : 'N/A', mangaCoverUrl: details ? details.coverUrl : null };
        });
        res.status(200).json({ message: "History berhasil diambil.", data: enrichedHistory, pagination: { currentPage: page, totalPages: totalPages, itemsPerPage: limit, totalItems: totalItems } });
    } catch (error) {
        console.error("Get history error:", error);
        next(error);
    }
};

// Mengupdate profil pengguna
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { username, profile_image_url } = req.body;
        const updates = {};
        if (username !== undefined) updates.username = username;
        if (profile_image_url !== undefined) updates.profile_image_url = profile_image_url;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'Tidak ada data untuk diupdate.' });
        }
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select('id, email, username, profile_image_url, created_at');
        if (error) throw error;
        const updatedUser = data && data.length > 0 ? data[0] : null;
        if (!updatedUser) return res.status(404).json({ message: 'User tidak ditemukan atau tidak ada perubahan.' });
        res.status(200).json({ message: 'Profil berhasil diperbarui!', user: updatedUser });
    } catch (error) {
        console.error("Update profile error:", error);
        next(error);
    }
};

module.exports = {
    addBookmark, getBookmarks, deleteBookmark,
    addHistory, getHistory,
    updateProfile, updatePassword,
    // Fungsi baru untuk reset password dengan OTP
    sendPasswordResetOTP, verifyPasswordResetOTP, resetPasswordWithOTP,
    // Fungsi test untuk debugging
    testSMTPConnection, testEmailAuth,
};