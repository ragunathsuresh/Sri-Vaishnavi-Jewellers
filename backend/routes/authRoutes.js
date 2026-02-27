
const express = require('express');
const { loginUser, logoutUser, refresh, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { loginLimiter } = require('../middlewares/rateLimiter');
const csrfProtection = require('../middlewares/csrfProtection');

const router = express.Router();

router.post('/login', loginLimiter, loginUser);
router.post('/logout', protect, logoutUser);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resettoken', resetPassword);
router.get('/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});


module.exports = router;
