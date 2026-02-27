const mongoose = require('mongoose');
const Expense = require('../models/Expense');

const EXPENSE_TYPES = ['Daily', 'Monthly'];

const toDateOnly = (input) => {
    const d = new Date(input);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getDayRange = (dateValue = new Date()) => {
    // Construct local YYYY-MM-DD to avoid early-morning UTC shift
    const localStr = dateValue.toLocaleDateString('en-CA');
    const start = new Date(localStr + 'T00:00:00.000Z');
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
};

const getMonthRange = (dateValue = new Date()) => {
    const localStr = dateValue.toLocaleDateString('en-CA').slice(0, 7);
    const start = new Date(localStr + '-01T00:00:00.000Z');
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { start, end };
};

const formatServerTime = (dateObj = new Date()) => dateObj.toLocaleTimeString('en-IN', {
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

const buildDateRangeFromQuery = (from, to) => {
    if (!from && !to) {
        return getDayRange();
    }

    const filter = {};
    if (from) {
        // Enforce ISO date matching for consistency
        const fromDate = new Date(`${from}T00:00:00.000Z`);
        if (Number.isNaN(fromDate.getTime())) {
            throw new Error('Invalid from date');
        }
        filter.$gte = fromDate;
    }

    if (to) {
        const toDate = new Date(`${to}T23:59:59.999Z`);
        if (Number.isNaN(toDate.getTime())) {
            throw new Error('Invalid to date');
        }
        filter.$lte = toDate;
    }

    return filter;
};

const normalizeListItem = (row) => ({
    _id: row._id,
    expenseName: row.expenseName,
    expenseType: row.expenseType,
    amount: Number(row.amount || 0),
    notes: row.notes || '',
    expenseDate: row.expenseDate,
    expenseTime: row.expenseTime || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
});

const createExpense = async (req, res) => {
    try {
        const { expenseName, expenseType, amount, notes, date } = req.body;

        if (!expenseName || !String(expenseName).trim()) {
            return res.status(400).json({ success: false, message: 'Expense name is required' });
        }

        if (!EXPENSE_TYPES.includes(expenseType)) {
            return res.status(400).json({ success: false, message: 'Expense type must be Daily or Monthly' });
        }

        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount < 0) {
            return res.status(400).json({ success: false, message: 'Amount must be a valid non-negative number' });
        }

        const now = new Date();
        // Use provided date or fallback to today
        const targetDate = date ? new Date(`${date}T00:00:00.000Z`) : new Date(now.setHours(0, 0, 0, 0));

        const expense = await Expense.create({
            expenseName: String(expenseName).trim(),
            expenseType,
            amount: numericAmount,
            notes: notes ? String(notes).trim() : '',
            expenseDate: targetDate,
            expenseTime: formatServerTime(now)
        });

        return res.status(201).json({
            success: true,
            data: normalizeListItem(expense)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to create expense' });
    }
};

const getExpenses = async (req, res) => {
    try {
        const { search = '', expenseType = 'All', from, to } = req.query;
        const query = {};
        const todayRange = getDayRange();
        const monthRange = getMonthRange();

        const dateFilter = buildDateRangeFromQuery(from, to);
        query.expenseDate = dateFilter;

        if (expenseType && expenseType !== 'All') {
            if (!EXPENSE_TYPES.includes(expenseType)) {
                return res.status(400).json({ success: false, message: 'expenseType must be Daily, Monthly, or All' });
            }
            query.expenseType = expenseType;
        }

        if (search && String(search).trim()) {
            query.expenseName = { $regex: String(search).trim(), $options: 'i' };
        }

        const [rows, todaySummary, monthSummary] = await Promise.all([
            Expense.find(query).sort({ expenseDate: -1, createdAt: -1 }),
            Expense.aggregate([
                { $match: { expenseDate: { $gte: todayRange.start, $lt: todayRange.end } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Expense.aggregate([
                { $match: { expenseDate: { $gte: monthRange.start, $lt: monthRange.end } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        const now = new Date();

        return res.status(200).json({
            success: true,
            data: rows.map(normalizeListItem),
            summary: {
                todayTotal: Number(todaySummary?.[0]?.total || 0),
                monthTotal: Number(monthSummary?.[0]?.total || 0)
            },
            serverDateTime: {
                iso: now.toISOString(),
                date: toDateOnly(now),
                time: formatServerTime(now)
            }
        });
    } catch (error) {
        const status = /Invalid/.test(error.message) ? 400 : 500;
        return res.status(status).json({ success: false, message: error.message || 'Failed to fetch expenses' });
    }
};

const updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid expense id' });
        }

        const updates = {};
        if (req.body.expenseName !== undefined) {
            if (!String(req.body.expenseName).trim()) {
                return res.status(400).json({ success: false, message: 'Expense name is required' });
            }
            updates.expenseName = String(req.body.expenseName).trim();
        }

        if (req.body.expenseType !== undefined) {
            if (!EXPENSE_TYPES.includes(req.body.expenseType)) {
                return res.status(400).json({ success: false, message: 'Expense type must be Daily or Monthly' });
            }
            updates.expenseType = req.body.expenseType;
        }

        if (req.body.amount !== undefined) {
            const numericAmount = Number(req.body.amount);
            if (!Number.isFinite(numericAmount) || numericAmount < 0) {
                return res.status(400).json({ success: false, message: 'Amount must be a valid non-negative number' });
            }
            updates.amount = numericAmount;
        }

        if (req.body.notes !== undefined) {
            updates.notes = String(req.body.notes || '').trim();
        }

        if (req.body.date !== undefined) {
            updates.expenseDate = new Date(`${req.body.date}T00:00:00.000Z`);
        }

        const updated = await Expense.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }

        return res.status(200).json({ success: true, data: normalizeListItem(updated) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to update expense' });
    }
};

const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid expense id' });
        }

        const deleted = await Expense.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }

        return res.status(200).json({ success: true, message: 'Expense deleted' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to delete expense' });
    }
};

const getServerTime = async (req, res) => {
    const now = new Date();
    return res.status(200).json({
        success: true,
        data: {
            iso: now.toISOString(),
            date: toDateOnly(now),
            time: formatServerTime(now)
        }
    });
};

module.exports = {
    createExpense,
    getExpenses,
    updateExpense,
    deleteExpense,
    getServerTime
};
