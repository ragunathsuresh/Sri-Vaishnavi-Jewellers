const express = require('express');
const router = express.Router();
const {
    getDealers,
    getDealerById,
    setOpeningBalance,
    addDealerStock,
    getItemDetails,
    getDealerTransactions,
    deleteDealer
} = require('../controllers/dealerController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
    .get(getDealers);
router.get('/transactions', getDealerTransactions);

router.route('/:id')
    .get(getDealerById)
    .delete(deleteDealer);

router.post('/opening-balance', setOpeningBalance);
router.post('/stock-in', addDealerStock);
router.get('/item/:serialNo', getItemDetails);

module.exports = router;
