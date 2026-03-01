const express = require('express');
const {
    createChitFund,
    getChitFunds,
    getChitFundById,
    updateChitFund,
    deleteChitFund,
    getTodayRate,
    searchChitCustomers,
    deleteChitCustomerHistory
} = require('../controllers/chitFundController');
const { protect, blockReadOnly } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(blockReadOnly);

router.get('/today-rate', getTodayRate);
router.get('/customers/search', searchChitCustomers);
router.post('/', createChitFund);
router.get('/', getChitFunds);
router.get('/:id', getChitFundById);
router.put('/:id', updateChitFund);
router.delete('/:id', deleteChitFund);
router.delete('/customers/:phone', deleteChitCustomerHistory);

module.exports = router;
