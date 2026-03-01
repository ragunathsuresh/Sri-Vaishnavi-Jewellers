const express = require('express');
const { protect, blockReadOnly } = require('../middlewares/authMiddleware');
const {
    createExpense,
    getExpenses,
    updateExpense,
    deleteExpense,
    getServerTime
} = require('../controllers/expenseController');

const router = express.Router();

router.use(protect);
router.use(blockReadOnly);

router.get('/server-time', getServerTime);
router.route('/')
    .get(getExpenses)
    .post(createExpense);
router.route('/:id')
    .put(updateExpense)
    .delete(deleteExpense);

module.exports = router;
