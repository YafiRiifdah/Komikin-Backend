const mangadexService = require('../services/mangadexService');

const getLatestManga = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const mangaData = await mangadexService.getLatestUpdates(limit, offset);

    const totalItems = mangaData.total;
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      message: "Daftar manga terbaru berhasil diambil.",
      data: mangaData.results,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        itemsPerPage: limit,
        totalItems: totalItems,
        offsetFromAPI: mangaData.offset
      }
    });
  } catch (error) {
    next(error);
  }
};

const getPopularManga = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const mangaData = await mangadexService.getPopularManga(limit, offset);

    const totalItems = mangaData.total;
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      message: "Daftar manga populer berhasil diambil.",
      data: mangaData.results,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        itemsPerPage: limit,
        totalItems: totalItems,
        offsetFromAPI: mangaData.offset
      }
    });
  } catch (error) {
    next(error);
  }
};

const searchMangaByTitle = async (req, res, next) => {
    try {
        const { title } = req.query;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;

        if (!title) {
            return res.status(400).json({ message: 'Parameter "title" dibutuhkan.' });
        }

        const mangaData = await mangadexService.searchManga({ title, limit, offset });

        const totalItems = mangaData.total;
        const totalPages = Math.ceil(totalItems / limit);

        res.json({
            message: "Hasil pencarian manga berdasarkan judul.",
            data: mangaData.results,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                itemsPerPage: limit,
                totalItems: totalItems,
                offsetFromAPI: mangaData.offset
            }
        });
    } catch (error) {
        next(error);
    }
};

const getGenresList = async (req, res, next) => {
    try {
        const genres = await mangadexService.getGenres();
        res.json({
            message: "Daftar genre berhasil diambil.",
            data: genres
        });
    } catch (error) {
        next(error);
    }
};

const searchMangaByGenre = async (req, res, next) => {
    try {
        const { genreIds } = req.query;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;

        if (!genreIds) {
            return res.status(400).json({ message: 'Parameter "genreIds" dibutuhkan.' });
        }

        const mangaData = await mangadexService.searchManga({
            'includedTags[]': genreIds.split(','),
            limit,
            offset
        });

        const totalItems = mangaData.total;
        const totalPages = Math.ceil(totalItems / limit);

        res.json({
            message: "Hasil pencarian manga berdasarkan genre.",
            data: mangaData.results,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                itemsPerPage: limit,
                totalItems: totalItems,
                offsetFromAPI: mangaData.offset
            }
        });
    } catch (error) {
        next(error);
    }
};

const getMangaFeed = async (req, res, next) => {
    try {
        const { mangaId } = req.params;
        const limit = parseInt(req.query.limit) || 500;
        const offset = parseInt(req.query.offset) || 0;
        const { lang } = req.query;

        const params = { limit, offset };
        if (lang) params['translatedLanguage[]'] = lang.split(',');

        const feedData = await mangadexService.getMangaFeed(mangaId, params);
        // Jika ingin paginasi penuh untuk feed, mangadexService.getMangaFeed perlu diubah
        // untuk mengembalikan total chapter, lalu bangun objek paginasi di sini.

        res.json({
            message: "Daftar chapter berhasil diambil.",
            data: feedData,
        });
    } catch (error) {
        next(error);
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