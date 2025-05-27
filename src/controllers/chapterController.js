const mangadexService = require('../services/mangadexService');

const getChapterPages = async (req, res, next) => {
    try {
        const { chapterId } = req.params;
        const pagesData = await mangadexService.getChapterPages(chapterId);
        res.json(pagesData);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getChapterPages,
};
