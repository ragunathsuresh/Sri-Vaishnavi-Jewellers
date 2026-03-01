const express = require('express');
const router = express.Router();
const {
    getDealers,
    getDealerById,
    setOpeningBalance,
    addDealerStock,
    getItemDetails,
    getDealerTransactions,
    deleteDealer,
    deleteDealerTransaction
} = require('../controllers/dealerController');
const { protect, blockReadOnly } = require('../middlewares/authMiddleware');

router.use(protect);
router.use(blockReadOnly);

router.route('/')
    .get(getDealers);
router.get('/transactions', getDealerTransactions);

router.route('/:id')
    .get(getDealerById)
    .delete(deleteDealer);

router.delete('/transactions/:id', deleteDealerTransaction);

router.post('/opening-balance', setOpeningBalance);
router.post('/stock-in', addDealerStock);
router.get('/item/:serialNo', getItemDetails);

module.exports = router;
