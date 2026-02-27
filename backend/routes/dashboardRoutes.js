
const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getGoldRate,
    updateGoldRate
} = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/stats', protect, getDashboardStats);
router.get('/gold-rate', protect, getGoldRate);
router.post('/gold-rate', protect, updateGoldRate);

module.exports = router;
