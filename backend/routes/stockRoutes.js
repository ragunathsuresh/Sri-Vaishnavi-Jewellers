
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
const { protect, blockReadOnly } = require('../middlewares/authMiddleware');

router.use(protect);
router.use(blockReadOnly);

router.get('/', getStocks);
router.get('/search', searchStock);
router.post('/', addStock);
router.get('/serial/:serialNo', getStockBySerialNo);
router.get('/history/:serialNo', getStockHistoryBySerialNo);
router.get('/:id', getStockById);
router.put('/:id', updateStock);
router.delete('/:id', deleteStock);

module.exports = router;
