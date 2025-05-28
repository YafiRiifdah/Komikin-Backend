const mangadexService = require('../services/mangadexService');

const getLatestManga = async (req, res, next) => {
  // ... (kode getLatestManga tetap sama seperti di Canvas sebelumnya) ...
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const mangaData = await mangadexService.getLatestUpdates(limit, offset);
    const totalItems = mangaData.total;
    const totalPages = Math.ceil(totalItems / limit);
    res.json({ message: "Daftar manga terbaru berhasil diambil.", data: mangaData.results, pagination: { currentPage: page, totalPages: totalPages, itemsPerPage: limit, totalItems: totalItems, offsetFromAPI: mangaData.offset } });
  } catch (error) { next(error); }
};

const getPopularManga = async (req, res, next) => {
  // ... (kode getPopularManga tetap sama seperti di Canvas sebelumnya) ...
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const mangaData = await mangadexService.getPopularManga(limit, offset);
    const totalItems = mangaData.total;
    const totalPages = Math.ceil(totalItems / limit);
    res.json({ message: "Daftar manga populer berhasil diambil.", data: mangaData.results, pagination: { currentPage: page, totalPages: totalPages, itemsPerPage: limit, totalItems: totalItems, offsetFromAPI: mangaData.offset } });
  } catch (error) { next(error); }
};

const searchMangaByTitle = async (req, res, next) => {
    // ... (kode searchMangaByTitle tetap sama seperti di Canvas sebelumnya) ...
    try {
        const { title } = req.query;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;
        if (!title) return res.status(400).json({ message: 'Parameter "title" dibutuhkan.' });
        const mangaData = await mangadexService.searchManga({ title, limit, offset });
        const totalItems = mangaData.total;
        const totalPages = Math.ceil(totalItems / limit);
        res.json({ message: "Hasil pencarian manga berdasarkan judul.", data: mangaData.results, pagination: { currentPage: page, totalPages: totalPages, itemsPerPage: limit, totalItems: totalItems, offsetFromAPI: mangaData.offset } });
    } catch (error) { next(error); }
};

const getGenresList = async (req, res, next) => {
    // ... (kode getGenresList tetap sama seperti di Canvas sebelumnya) ...
    try {
        const genres = await mangadexService.getGenres();
        res.json({ message: "Daftar genre berhasil diambil.", data: genres });
    } catch (error) { next(error); }
};

const searchMangaByGenre = async (req, res, next) => {
    // ... (kode searchMangaByGenre tetap sama seperti di Canvas sebelumnya) ...
    try {
        const { genreIds } = req.query;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;
        if (!genreIds) return res.status(400).json({ message: 'Parameter "genreIds" dibutuhkan.' });
        const mangaData = await mangadexService.searchManga({ 'includedTags[]': genreIds.split(','), limit, offset });
        const totalItems = mangaData.total;
        const totalPages = Math.ceil(totalItems / limit);
        res.json({ message: "Hasil pencarian manga berdasarkan genre.", data: mangaData.results, pagination: { currentPage: page, totalPages: totalPages, itemsPerPage: limit, totalItems: totalItems, offsetFromAPI: mangaData.offset } });
    } catch (error) { next(error); }
};

const getMangaFeed = async (req, res, next) => {
    console.log(`[mangaController.getMangaFeed] DITERIMA - Manga ID: ${req.params.mangaId}, Query:`, JSON.stringify(req.query)); // <-- Log Awal
    try {
        const { mangaId } = req.params;
        const limit = parseInt(req.query.limit) || 500; // Default disesuaikan dengan service
        const offset = parseInt(req.query.offset) || 0;
        const { lang } = req.query;

        const params = { limit, offset };
        if (lang) params['translatedLanguage[]'] = lang.split(',');

        console.log(`[mangaController.getMangaFeed] MEMANGGIL service.getMangaFeed untuk mangaId: ${mangaId} dengan params:`, JSON.stringify(params)); // <-- Log Sebelum Panggil Service
        const feedData = await mangadexService.getMangaFeed(mangaId, params);
        console.log(`[mangaController.getMangaFeed] BERHASIL dapat data dari service, jumlah chapter: ${feedData.length}`); // <-- Log Setelah Panggil Service

        res.json({
            message: "Daftar chapter berhasil diambil.",
            data: feedData,
        });
    } catch (error) {
        console.error(`[mangaController.getMangaFeed] ERROR Controller:`, error.message); // <-- Log Error di Controller
        console.error(`[mangaController.getMangaFeed] ERROR STACK Controller:`, error.stack);
        next(error); // Lempar ke errorHandler utama
    }
};

module.exports = {
  getLatestManga,
  getPopularManga,
  searchMangaByTitle,
  getGenresList,
  searchMangaByGenre,
  getMangaFeed,
};
