const express = require('express');
const router = express.Router();
const {
    createLineStock,
    createManualLineStock,
    getLineStocks,
    getLineStockById,
    settleLineStock,
    getLineStockReceivables,
    deletePersonLineStocks
} = require('../controllers/lineStockController');
const { protect, blockReadOnly } = require('../middlewares/authMiddleware');

router.use(protect);
router.use(blockReadOnly);
router.post('/create', createLineStock);
router.post('/manual', createManualLineStock);
router.delete('/', deletePersonLineStocks);
router.get('/receivable', getLineStockReceivables);
router.get('/', getLineStocks);
router.get('/:id', getLineStockById);
router.put('/settle/:id', settleLineStock);

module.exports = router;
