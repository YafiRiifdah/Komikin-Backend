const express = require('express');
const router = express.Router();
const chapterController = require('../controllers/chapterController');

router.get('/:chapterId/pages', chapterController.getChapterPages);

module.exports = router;