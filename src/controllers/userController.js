const supabase = require('../config/supabaseClient');
const mangadexService = require('../services/mangadexService');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Force load dotenv
require('dotenv').config();

// Konfigurasi Email (contoh menggunakan Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // email Anda
        pass: process.env.EMAIL_PASS  // app password Gmail
    }
});

// Generate OTP 6 digit
const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
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
        console.log('==================');
        
        // DEBUG: Log Supabase config
        console.log('=== SUPABASE DEBUG ===');
        console.log('SUPABASE_URL:', process.env.SUPABASE_URL?.substring(0, 30) + '...');
        console.log('SUPABASE_SERVICE_KEY exists:', !!process.env.SUPABASE_SERVICE_KEY);
        console.log('SUPABASE_SERVICE_KEY length:', process.env.SUPABASE_SERVICE_KEY?.length);
        console.log('SUPABASE_SERVICE_KEY starts with:', process.env.SUPABASE_SERVICE_KEY?.substring(0, 30));
        console.log('========================');
        
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
        const createdAt = new Date();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit dari sekarang
        
        // Format waktu untuk email
        const timeOptions = { 
            timeZone: 'Asia/Jakarta', 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };
        const startTime = createdAt.toLocaleString('id-ID', timeOptions);
        const endTime = expiresAt.toLocaleString('id-ID', timeOptions);
        
        // Hitung progress untuk visual indicator
        const currentMinute = createdAt.getMinutes();
        const progressBars = [];
        for(let i = 0; i < 10; i++) {
            progressBars.push(i < 10 ? '🟩' : '⬜');
        }

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
            from: process.env.EMAIL_USER,
            to: email,
            subject: '🔐 Kode Verifikasi Reset Password - KomikIn',
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
                        
                        <!-- Timer Information Box -->
                        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 25px; border-radius: 10px; margin: 25px 0; text-align: center;">
                            <h3 style="margin: 0 0 20px 0; font-size: 20px;">⏰ INFORMASI WAKTU</h3>
                            
                            <!-- Time Details -->
                            <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 8px; margin: 15px 0;">
                                <table style="width: 100%; color: white; font-size: 14px;">
                                    <tr>
                                        <td style="padding: 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.3);">
                                            <strong>📅 Kode Dikirim:</strong>
                                        </td>
                                        <td style="padding: 8px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.3);">
                                            ${startTime}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.3);">
                                            <strong>⏰ Berlaku Hingga:</strong>
                                        </td>
                                        <td style="padding: 8px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.3);">
                                            ${endTime}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px; text-align: left;">
                                            <strong>⏳ Durasi Valid:</strong>
                                        </td>
                                        <td style="padding: 8px; text-align: right;">
                                            <span style="font-size: 18px; font-weight: bold;">10 MENIT</span>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            
                            <!-- Visual Time Indicator -->
                            <div style="margin: 20px 0;">
                                <p style="margin: 0 0 10px 0; font-size: 14px; opacity: 0.9;">Waktu tersisa (visual):</p>
                                <div style="font-size: 20px; letter-spacing: 2px;">
                                    🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩
                                </div>
                                <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.8;">
                                    🟩 = Menit tersisa | ⬜ = Waktu habis
                                </p>
                            </div>
                            
                            <!-- Urgency Message -->
                            <div style="background: rgba(255,255,255,0.3); padding: 15px; border-radius: 8px; margin: 15px 0;">
                                <p style="margin: 0; font-size: 16px; font-weight: bold;">
                                    🚨 SEGERA GUNAKAN KODE INI!
                                </p>
                                <p style="margin: 5px 0 0 0; font-size: 13px;">
                                    Jangan tunggu terlalu lama - kode akan otomatis expire!
                                </p>
                            </div>
                        </div>
                        
                        <!-- Step by Step Instructions -->
                        <div style="background-color: #e3f2fd; border: 1px solid #bbdefb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h4 style="margin: 0 0 15px 0; color: #1976d2; font-size: 16px;">📋 Cara Menggunakan Kode:</h4>
                            <ol style="margin: 0; padding-left: 20px; color: #1565c0;">
                                <li style="margin-bottom: 8px;"><strong>Copy kode OTP</strong> di atas</li>
                                <li style="margin-bottom: 8px;"><strong>Buka aplikasi/website</strong> KomikIn</li>
                                <li style="margin-bottom: 8px;"><strong>Paste kode</strong> pada form verifikasi</li>
                                <li style="margin-bottom: 8px;"><strong>Masukkan password baru</strong> Anda</li>
                                <li><strong>Selesai!</strong> Password berhasil direset</li>
                            </ol>
                        </div>
                        
                        <!-- Warning Box -->
                        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; color: #856404; font-size: 14px;">
                                ⚠️ <strong>PENTING:</strong> Kode ini hanya berlaku <strong>10 menit</strong> sejak email dikirim (${startTime}).
                                Setelah waktu habis, Anda perlu request kode baru.
                            </p>
                        </div>
                        
                        <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; color: #0c5460; font-size: 14px;">
                                🔒 <strong>Keamanan:</strong> Jangan bagikan kode ini kepada siapapun. 
                                Tim KomikIn tidak akan pernah meminta kode verifikasi Anda melalui telepon atau chat.
                            </p>
                        </div>
                        
                        <!-- Quick Copy Section -->
                        <div style="text-align: center; margin: 30px 0;">
                            <div style="background: #f8f9fa; border: 2px dashed #667eea; padding: 20px; border-radius: 8px;">
                                <p style="margin: 0 0 10px 0; color: #333; font-size: 14px;">
                                    💡 <strong>Quick Copy:</strong>
                                </p>
                                <div style="background: white; padding: 10px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; letter-spacing: 3px; color: #667eea;">
                                    ${otp}
                                </div>
                                <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">
                                    Tap/klik untuk select, lalu copy
                                </p>
                            </div>
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

        await transporter.sendMail(mailOptions);

        res.status(200).json({ 
            message: 'Kode OTP telah dikirim ke email Anda.',
            email: email 
        });

    } catch (error) {
        console.error("Send OTP error:", error);
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
};