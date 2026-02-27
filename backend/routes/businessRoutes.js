const express = require('express');
const router = express.Router();
const { calculate, getSummary } = require('../controllers/businessController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/calculate', protect, calculate);
router.get('/summary', protect, getSummary);

module.exports = router;
