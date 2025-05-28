const mangadexService = require('../services/mangadexService');

const getChapterPages = async (req, res, next) => {
    console.log(`[chapterController.getChapterPages] DITERIMA - Chapter ID: ${req.params.chapterId}`);
    try {
        const { chapterId } = req.params;
        console.log(`[chapterController.getChapterPages] MEMANGGIL service.getChapterPages untuk chapterId: ${chapterId}`);
        const pagesData = await mangadexService.getChapterPages(chapterId);
        console.log(`[chapterController.getChapterPages] BERHASIL dapat data dari service`);
        res.json(pagesData);
    } catch (error) {
        console.error(`[chapterController.getChapterPages] ERROR Controller:`, error.message);
        console.error(`[chapterController.getChapterPages] ERROR STACK Controller:`, error.stack);
        next(error);
    }
};

module.exports = {
    getChapterPages,
};
