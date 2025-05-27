const supabase = require('../config/supabaseClient');
const mangadexService = require('../services/mangadexService');
const bcrypt = require('bcryptjs');

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
            .select(); // Untuk mendapatkan data yang dihapus

        // Perbaikan: Supabase delete() dengan select() mengembalikan data yang dihapus,
        // jadi kita cek apakah 'data' ada dan tidak kosong.
        // 'count' mungkin tidak selalu diisi dengan benar oleh semua versi supabase-js untuk delete.
        console.log("DEBUG: Respons Supabase Delete -> Error:", error, "Data (dihapus):", data);
        if (error) throw error;
        if (!data || data.length === 0) { // Jika tidak ada data yang dikembalikan, berarti tidak ada yang cocok untuk dihapus
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
            } catch (mangadexErr) { console.error("Error fetching manga details for history:", mangadexErr.message); }
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

// Mengupdate password pengguna
const updatePassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Password saat ini dan password baru dibutuhkan.' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });
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

module.exports = {
    addBookmark, getBookmarks, deleteBookmark,
    addHistory, getHistory,
    updateProfile, updatePassword,
};
