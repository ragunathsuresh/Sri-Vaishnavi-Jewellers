const billingService = require('../services/billingService');

const getSummary = async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().slice(0, 10);
        const data = await billingService.getBillingSummary(date);
        res.status(200).json({ success: true, data });
    } catch (error) {
        const status = /Invalid date/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

const getMonthlySummary = async (req, res) => {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const data = await billingService.getMonthlyBillingSummary(month);
        res.status(200).json({ success: true, data });
    } catch (error) {
        const status = /Invalid month/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

const getExpenses = async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().slice(0, 10);
        const data = await billingService.getExpensesByDate(date);
        res.status(200).json({ success: true, data });
    } catch (error) {
        const status = /Invalid date/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

const addExpense = async (req, res) => {
    try {
        const { date, name, amount } = req.body;
        const expense = await billingService.createExpense({ date, name, amount });
        res.status(201).json({ success: true, data: expense });
    } catch (error) {
        const status = /required|Invalid|must be/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

const editExpense = async (req, res) => {
    try {
        const expense = await billingService.updateExpense(req.params.id, req.body);
        res.status(200).json({ success: true, data: expense });
    } catch (error) {
        const status = /Invalid|required|must be|not found/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

const removeExpense = async (req, res) => {
    try {
        await billingService.deleteExpense(req.params.id);
        res.status(200).json({ success: true });
    } catch (error) {
        const status = /Invalid|not found/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

const setCashBalance = async (req, res) => {
    try {
        const balance = await billingService.updateCashBalance(req.body.amount);
        res.status(200).json({ success: true, data: { balance } });
    } catch (error) {
        const status = /must be|Invalid/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

const createOtherTransaction = async (req, res) => {
    try {
        const transaction = await billingService.addOtherTransaction(req.body);
        res.status(201).json({ success: true, data: transaction });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const removeOtherTransaction = async (req, res) => {
    try {
        await billingService.deleteOtherTransaction(req.params.id);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    getSummary,
    getMonthlySummary,
    getExpenses,
    addExpense,
    editExpense,
    removeExpense,
    setCashBalance,
    createOtherTransaction,
    removeOtherTransaction
};
