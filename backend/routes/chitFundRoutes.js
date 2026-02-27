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
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/today-rate', protect, getTodayRate);
router.get('/customers/search', protect, searchChitCustomers);
router.post('/', protect, createChitFund);
router.get('/', protect, getChitFunds);
router.get('/:id', protect, getChitFundById);
router.put('/:id', protect, updateChitFund);
router.delete('/:id', protect, deleteChitFund);
router.delete('/customers/:phone', protect, deleteChitCustomerHistory);

module.exports = router;
