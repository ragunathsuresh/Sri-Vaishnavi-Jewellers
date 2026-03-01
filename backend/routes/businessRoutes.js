const express = require('express');
const router = express.Router();
const { calculate, getSummary } = require('../controllers/businessController');
const { protect, blockReadOnly } = require('../middlewares/authMiddleware');

router.use(protect);
router.use(blockReadOnly);

router.post('/calculate', calculate);
router.get('/summary', getSummary);

module.exports = router;
