
const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getGoldRate,
    updateGoldRate
} = require('../controllers/dashboardController');
const { protect, blockReadOnly } = require('../middlewares/authMiddleware');

router.use(protect);
router.use(blockReadOnly);

router.get('/stats', getDashboardStats);
router.get('/gold-rate', getGoldRate);
router.post('/gold-rate', updateGoldRate);

module.exports = router;
