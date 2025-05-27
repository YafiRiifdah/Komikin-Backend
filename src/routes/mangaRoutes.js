const express = require('express');
const router = express.Router();
const mangaController = require('../controllers/mangaController');

router.get('/latest', mangaController.getLatestManga);
router.get('/popular', mangaController.getPopularManga);
router.get('/search/title', mangaController.searchMangaByTitle);
router.get('/genres', mangaController.getGenresList);
router.get('/search/genre', mangaController.searchMangaByGenre);
router.get('/:mangaId/feed', mangaController.getMangaFeed);

module.exports = router;
