
const express = require('express');
const router = express.Router();
const { createSale, searchCustomer, getSales, getSaleById, updateSale, deleteSale } = require('../controllers/salesController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, createSale);
router.get('/', protect, getSales);
router.get('/customer/search', protect, searchCustomer);
router.get('/:id', protect, getSaleById);
router.put('/:id', protect, updateSale);
router.delete('/:id', protect, deleteSale);

module.exports = router;
