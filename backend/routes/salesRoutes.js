
const express = require('express');
const router = express.Router();
const { createSale, searchCustomer, getSales, getSaleById } = require('../controllers/salesController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, createSale);
router.get('/', protect, getSales);
router.get('/customer/search', protect, searchCustomer);
router.get('/:id', protect, getSaleById);

module.exports = router;
