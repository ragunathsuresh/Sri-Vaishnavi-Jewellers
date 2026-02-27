
const express = require('express');
const router = express.Router();
const {
    getStocks,
    addStock,
    getStockById,
    updateStock,
    getStockBySerialNo,
    searchStock,
    getStockHistoryBySerialNo,
    deleteStock
} = require('../controllers/stockController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, getStocks);
router.get('/search', protect, searchStock);
router.post('/', protect, addStock);
router.get('/serial/:serialNo', protect, getStockBySerialNo);
router.get('/history/:serialNo', protect, getStockHistoryBySerialNo);
router.get('/:id', protect, getStockById);
router.put('/:id', protect, updateStock);
router.delete('/:id', protect, deleteStock);

module.exports = router;
