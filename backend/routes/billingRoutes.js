const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
    getSummary,
    getMonthlySummary,
    getExpenses,
    addExpense,
    editExpense,
    removeExpense,
    setCashBalance,
    createOtherTransaction,
    removeOtherTransaction
} = require('../controllers/billingController');

const router = express.Router();

router.use(protect);

router.get('/summary', getSummary);
router.get('/monthly-summary', getMonthlySummary);
router.get('/expenses', getExpenses);
router.post('/expenses', addExpense);
router.put('/expenses/:id', editExpense);
router.delete('/expenses/:id', removeExpense);
router.put('/cash-balance', setCashBalance);
router.post('/other-transactions', createOtherTransaction);
router.delete('/other-transactions/:id', removeOtherTransaction);

module.exports = router;
