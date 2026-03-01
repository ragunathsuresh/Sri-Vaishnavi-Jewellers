const express = require('express');
const router = express.Router();
const { createSale, searchCustomer, getSales, getSaleById, updateSale, deleteSale } = require('../controllers/salesController');
const { protect, blockReadOnly } = require('../middlewares/authMiddleware');

router.use(protect);
router.use(blockReadOnly);

router.post('/', createSale);
router.get('/', getSales);
router.get('/customer/search', searchCustomer);
router.get('/:id', getSaleById);
router.put('/:id', updateSale);
router.delete('/:id', deleteSale);

module.exports = router;
