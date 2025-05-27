const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Semua rute di bawah ini akan dilindungi oleh middleware 'protect'
router.use(protect);

// Rute Bookmark
router.route('/bookmarks')
    .post(userController.addBookmark)
    .get(userController.getBookmarks);
router.delete('/bookmarks/:mangaId', userController.deleteBookmark);

// Rute History
router.route('/history')
    .post(userController.addHistory)
    .get(userController.getHistory);

// Rute Profil Pengguna
router.patch('/profile', userController.updateProfile);

// Rute Ganti Password
router.patch('/password', userController.updatePassword);

module.exports = router;