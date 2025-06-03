const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// ========================================
// ROUTES TANPA MIDDLEWARE PROTECT
// (Untuk user yang belum login)
// ========================================

// Rute Reset Password dengan OTP
router.post('/send-reset-otp', userController.sendPasswordResetOTP);
router.post('/verify-reset-otp', userController.verifyPasswordResetOTP);
router.post('/reset-password', userController.resetPasswordWithOTP);

// ========================================
// MIDDLEWARE PROTECT
// Semua rute di bawah ini dilindungi authentication
// ========================================
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

// Rute Ganti Password (untuk user yang sudah login)
router.patch('/password', userController.updatePassword);

module.exports = router;