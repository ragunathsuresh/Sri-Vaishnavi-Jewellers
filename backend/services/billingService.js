const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const Sale = require('../models/Sale');
const Account = require('../models/Account');
const DealerTransaction = require('../models/DealerTransaction');
const Expense = require('../models/Expense');
const ChitFund = require('../models/ChitFund');
const OtherTransaction = require('../models/OtherTransaction');

const parseDateInput = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    const base = new Date(`${dateString}T00:00:00.000Z`);
    if (Number.isNaN(base.getTime())) {
        throw new Error('Invalid date value');
    }
    const start = new Date(base);
    const end = new Date(base);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
};

const parseMonthInput = (monthString) => {
    if (!monthString || !/^\d{4}-\d{2}$/.test(monthString)) {
        throw new Error('Invalid month format. Use YYYY-MM');
    }
    const base = new Date(`${monthString}-01T00:00:00.000Z`);
    if (Number.isNaN(base.getTime())) {
        throw new Error('Invalid month value');
    }
    const start = new Date(base);
    const end = new Date(base);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { start, end };
};

const round3 = (value) => Number((Number(value) || 0).toFixed(3));

const ensureCashAccount = async () => {
    let cash = await Account.findOne({ type: 'Cash' });
    if (!cash) {
        cash = await Account.create({
            name: 'Cash Drawer',
            type: 'Cash',
            balance: 0
        });
    }
    return cash;
};

const getBillingSummary = async (dateString) => {
    const { start, end } = parseDateInput(dateString);

    const [stockCount, stockWeightAgg, salesBillsCount, cashAccount] = await Promise.all([
        Stock.countDocuments(),
        Stock.aggregate([
            {
                $group: {
                    _id: null,
                    totalWeight: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ['$netWeight', 0] },
                                { $ifNull: ['$currentCount', 0] }
                            ]
                        }
                    }
                }
            }
        ]),
        Sale.countDocuments({ createdAt: { $gte: start, $lt: end } }),
        ensureCashAccount()
    ]);

    const customerSales = await Sale.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        {
            $project: {
                customerName: '$customerDetails.name',
                phoneNumber: '$customerDetails.phone',
                date: '$date',
                time: '$time',
                createdAt: 1,
                issuedItems: 1
            }
        },
        { $unwind: '$issuedItems' },
        {
            $project: {
                customerName: { $ifNull: ['$customerName', '-'] },
                phoneNumber: { $ifNull: ['$phoneNumber', '-'] },
                date: {
                    $ifNull: [
                        '$date',
                        {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt'
                            }
                        }
                    ]
                },
                time: { $ifNull: ['$time', '-'] },
                billNumber: {
                    $ifNull: [
                        '$issuedItems.billNo',
                        {
                            $concat: ['BILL-', { $substr: [{ $toString: '$_id' }, 18, 6] }]
                        }
                    ]
                },
                itemName: { $ifNull: ['$issuedItems.itemName', '-'] },
                weight: {
                    $ifNull: [
                        '$issuedItems.weight',
                        { $ifNull: ['$issuedItems.netWeight', 0] }
                    ]
                },
                sriCost: { $ifNull: ['$issuedItems.sriCost', 0] },
                sriBill: { $ifNull: ['$issuedItems.sriBill', 0] },
                plus: { $ifNull: ['$issuedItems.plus', 0] }
            }
        },
        { $sort: { date: -1, time: -1 } }
    ]);

    const plusSummaryMap = new Map();
    customerSales.forEach((row) => {
        const plus = Number(row.plus || 0);
        const weight = Number(row.weight || 0);
        const current = plusSummaryMap.get(plus) || { plus, totalWeight: 0 };
        current.totalWeight += weight;
        plusSummaryMap.set(plus, current);
    });

    const plusSummary = Array.from(plusSummaryMap.values())
        .map((row) => {
            const totalWeight = round3(row.totalWeight);
            const profit = round3((Number(row.plus) * totalWeight) / 100);
            return {
                plus: Number(row.plus),
                totalWeight,
                profit
            };
        })
        .sort((a, b) => a.plus - b.plus);

    const plusSummaryTotals = plusSummary.reduce(
        (acc, row) => ({
            totalWeight: round3(acc.totalWeight + row.totalWeight),
            totalProfit: round3(acc.totalProfit + row.profit)
        }),
        { totalWeight: 0, totalProfit: 0 }
    );

    const dateLimit = end.toISOString().split('T')[0];
    const dealerRows = await DealerTransaction.aggregate([
        { $match: { date: { $lt: dateLimit } } },
        { $sort: { date: -1, time: -1, createdAt: -1 } },
        {
            $group: {
                _id: '$dealerId',
                latestBalance: { $first: '$balanceAfter' }
            }
        },
        {
            $lookup: {
                from: 'dealers',
                localField: '_id',
                foreignField: '_id',
                as: 'dealer'
            }
        },
        {
            $project: {
                _id: 0,
                name: { $ifNull: [{ $arrayElemAt: ['$dealer.name', 0] }, '-'] },
                phoneNumber: { $ifNull: [{ $arrayElemAt: ['$dealer.phoneNumber', 0] }, '-'] },
                amount: { $ifNull: ['$latestBalance', 0] }
            }
        },
        { $sort: { name: 1 } }
    ]);

    const debtPayable = dealerRows
        .filter((row) => Number(row.amount) < 0)
        .map((row) => ({
            name: row.name,
            phoneNumber: row.phoneNumber,
            amount: round3(Math.abs(Number(row.amount || 0)))
        }));

    const debtReceivable = dealerRows
        .filter((row) => Number(row.amount) >= 0)
        .map((row) => ({
            name: row.name,
            phoneNumber: row.phoneNumber,
            amount: round3(Number(row.amount || 0))
        }));

    const expenseRows = await Expense.find({ expenseDate: { $gte: start, $lt: end } }).sort({ createdAt: 1 });
    const expenses = expenseRows.map((row) => ({
        _id: row._id,
        expenseName: row.expenseName,
        expenseType: row.expenseType,
        amount: round3(row.amount),
        expenseDate: row.expenseDate,
        expenseTime: row.expenseTime || '',
        notes: row.notes || ''
    }));
    const expensesTotal = round3(expenses.reduce((acc, row) => acc + Number(row.amount || 0), 0));

    const chitRows = await ChitFund.find({ date: { $gte: start, $lt: end } })
        .select('date amount gramsPurchased')
        .sort({ date: 1, createdAt: 1 });
    const chitFunds = chitRows.map((row) => ({
        _id: row._id,
        date: row.date,
        amount: round3(row.amount),
        gramsPurchased: round3(row.gramsPurchased)
    }));
    const chitFundsTotal = round3(chitFunds.reduce((acc, row) => acc + Number(row.amount || 0), 0));
    const chitFundsGrams = round3(chitFunds.reduce((acc, row) => acc + Number(row.gramsPurchased || 0), 0));

    const otherTransactions = await OtherTransaction.find({
        date: { $gte: start, $lt: end }
    }).sort({ date: 1, createdAt: 1 });

    return {
        selectedDate: dateString,
        currentDateTime: new Date().toISOString(),
        cards: {
            totalStockItems: stockCount,
            totalStockWeight: round3(stockWeightAgg?.[0]?.totalWeight || 0),
            dailySalesBills: salesBillsCount,
            cashBalance: round3(cashAccount.balance || 0)
        },
        customerSales: customerSales.map((row) => ({
            ...row,
            weight: round3(row.weight),
            sriCost: round3(row.sriCost),
            sriBill: round3(row.sriBill),
            plus: round3(row.plus)
        })),
        plusSummary,
        plusSummaryTotals,
        debtPayable,
        debtReceivable,
        expenses,
        expensesTotal,
        chitFunds,
        chitFundsTotal,
        chitFundsGrams,
        otherTransactions: otherTransactions.map(t => ({
            _id: t._id,
            date: t.date,
            name: t.name,
            description: t.description,
            type: t.type,
            grams: round3(t.grams),
            amount: round3(t.amount)
        }))
    };
};

const getMonthlyBillingSummary = async (monthString) => {
    const { start, end } = parseMonthInput(monthString);

    const [stockCount, stockWeightAgg, salesBillsCount, cashAccount] = await Promise.all([
        Stock.countDocuments(),
        Stock.aggregate([
            {
                $group: {
                    _id: null,
                    totalWeight: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ['$netWeight', 0] },
                                { $ifNull: ['$currentCount', 0] }
                            ]
                        }
                    }
                }
            }
        ]),
        Sale.countDocuments({ createdAt: { $gte: start, $lt: end } }),
        ensureCashAccount()
    ]);

    const customerSales = await Sale.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        {
            $project: {
                customerName: '$customerDetails.name',
                phoneNumber: '$customerDetails.phone',
                date: '$date',
                time: '$time',
                createdAt: 1,
                issuedItems: 1
            }
        },
        { $unwind: '$issuedItems' },
        {
            $project: {
                customerName: { $ifNull: ['$customerName', '-'] },
                phoneNumber: { $ifNull: ['$phoneNumber', '-'] },
                date: {
                    $ifNull: [
                        '$date',
                        {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt'
                            }
                        }
                    ]
                },
                time: { $ifNull: ['$time', '-'] },
                billNumber: {
                    $ifNull: [
                        '$issuedItems.billNo',
                        {
                            $concat: ['BILL-', { $substr: [{ $toString: '$_id' }, 18, 6] }]
                        }
                    ]
                },
                itemName: { $ifNull: ['$issuedItems.itemName', '-'] },
                weight: {
                    $ifNull: [
                        '$issuedItems.weight',
                        { $ifNull: ['$issuedItems.netWeight', 0] }
                    ]
                },
                sriCost: { $ifNull: ['$issuedItems.sriCost', 0] },
                sriBill: { $ifNull: ['$issuedItems.sriBill', 0] },
                plus: { $ifNull: ['$issuedItems.plus', 0] }
            }
        },
        { $sort: { date: -1, time: -1 } }
    ]);

    const plusSummaryMap = new Map();
    customerSales.forEach((row) => {
        const plus = Number(row.plus || 0);
        const weight = Number(row.weight || 0);
        const current = plusSummaryMap.get(plus) || { plus, totalWeight: 0 };
        current.totalWeight += weight;
        plusSummaryMap.set(plus, current);
    });

    const plusSummary = Array.from(plusSummaryMap.values())
        .map((row) => {
            const totalWeight = round3(row.totalWeight);
            const profit = round3((Number(row.plus) * totalWeight) / 100);
            return {
                plus: Number(row.plus),
                totalWeight,
                profit
            };
        })
        .sort((a, b) => a.plus - b.plus);

    const plusSummaryTotals = plusSummary.reduce(
        (acc, row) => ({
            totalWeight: round3(acc.totalWeight + row.totalWeight),
            totalProfit: round3(acc.totalProfit + row.profit)
        }),
        { totalWeight: 0, totalProfit: 0 }
    );

    const dateLimit = end.toISOString().split('T')[0];
    const dealerRows = await DealerTransaction.aggregate([
        { $match: { date: { $lt: dateLimit } } },
        { $sort: { date: -1, time: -1, createdAt: -1 } },
        {
            $group: {
                _id: '$dealerId',
                latestBalance: { $first: '$balanceAfter' }
            }
        },
        {
            $lookup: {
                from: 'dealers',
                localField: '_id',
                foreignField: '_id',
                as: 'dealer'
            }
        },
        {
            $project: {
                _id: 0,
                name: { $ifNull: [{ $arrayElemAt: ['$dealer.name', 0] }, '-'] },
                phoneNumber: { $ifNull: [{ $arrayElemAt: ['$dealer.phoneNumber', 0] }, '-'] },
                amount: { $ifNull: ['$latestBalance', 0] }
            }
        },
        { $sort: { name: 1 } }
    ]);

    const debtPayable = dealerRows
        .filter((row) => Number(row.amount) < 0)
        .map((row) => ({
            name: row.name,
            phoneNumber: row.phoneNumber,
            amount: round3(Math.abs(Number(row.amount || 0)))
        }));

    const debtReceivable = dealerRows
        .filter((row) => Number(row.amount) >= 0)
        .map((row) => ({
            name: row.name,
            phoneNumber: row.phoneNumber,
            amount: round3(Number(row.amount || 0))
        }));

    const debtPayableTotal = round3(debtPayable.reduce((acc, row) => acc + Number(row.amount || 0), 0));
    const debtReceivableTotal = round3(debtReceivable.reduce((acc, row) => acc + Number(row.amount || 0), 0));

    const expenseRows = await Expense.find({ expenseDate: { $gte: start, $lt: end } }).sort({ expenseDate: 1, createdAt: 1 });
    const expenses = expenseRows.map((row) => ({
        _id: row._id,
        expenseName: row.expenseName,
        expenseType: row.expenseType,
        amount: round3(row.amount),
        expenseDate: row.expenseDate,
        expenseTime: row.expenseTime || '',
        notes: row.notes || ''
    }));
    const expensesTotal = round3(expenses.reduce((acc, row) => acc + Number(row.amount || 0), 0));

    const chitRows = await ChitFund.find({ date: { $gte: start, $lt: end } })
        .select('date amount gramsPurchased')
        .sort({ date: 1, createdAt: 1 });
    const chitFunds = chitRows.map((row) => ({
        _id: row._id,
        date: row.date,
        amount: round3(row.amount),
        gramsPurchased: round3(row.gramsPurchased)
    }));
    const chitFundsTotal = round3(chitFunds.reduce((acc, row) => acc + Number(row.amount || 0), 0));
    const chitFundsGrams = round3(chitFunds.reduce((acc, row) => acc + Number(row.gramsPurchased || 0), 0));

    const otherTransactions = await OtherTransaction.find({ month: monthString }).sort({ date: 1, createdAt: 1 });

    return {
        selectedMonth: monthString,
        currentDateTime: new Date().toISOString(),
        cards: {
            totalStockItems: stockCount,
            totalStockWeight: round3(stockWeightAgg?.[0]?.totalWeight || 0),
            monthlySalesBills: salesBillsCount,
            cashBalance: round3(cashAccount.balance || 0)
        },
        customerSales: customerSales.map((row) => ({
            ...row,
            weight: round3(row.weight),
            sriCost: round3(row.sriCost),
            sriBill: round3(row.sriBill),
            plus: round3(row.plus)
        })),
        plusSummary,
        plusSummaryTotals,
        debtPayable,
        debtPayableTotal,
        debtReceivable,
        debtReceivableTotal,
        expenses,
        expensesTotal,
        chitFunds,
        chitFundsTotal,
        chitFundsGrams,
        otherTransactions: otherTransactions.map(t => ({
            _id: t._id,
            date: t.date,
            name: t.name,
            description: t.description,
            type: t.type,
            grams: round3(t.grams),
            amount: round3(t.amount)
        }))
    };
};

const getExpensesByDate = async (dateString) => {
    const { start, end } = parseDateInput(dateString);
    const expenses = await Expense.find({ expenseDate: { $gte: start, $lt: end } }).sort({ createdAt: 1 });
    const rows = expenses.map((exp) => ({
        _id: exp._id,
        name: exp.expenseName,
        amount: round3(exp.amount),
        date: exp.expenseDate
    }));
    const total = round3(rows.reduce((acc, row) => acc + Number(row.amount || 0), 0));
    return { rows, total };
};

const createExpense = async ({ date, name, amount }) => {
    parseDateInput(date);
    if (!name || !String(name).trim()) {
        throw new Error('Expense name is required');
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        throw new Error('Expense amount must be a valid non-negative number');
    }
    const expense = await Expense.create({
        expenseName: String(name).trim(),
        expenseType: 'Daily',
        amount: numericAmount,
        expenseDate: new Date(`${date}T00:00:00.000Z`),
        expenseTime: '00:00:00'
    });
    return expense;
};

const updateExpense = async (id, payload) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid expense id');
    }
    const updates = {};
    if (payload.name !== undefined) {
        if (!String(payload.name).trim()) {
            throw new Error('Expense name is required');
        }
        updates.expenseName = String(payload.name).trim();
    }
    if (payload.amount !== undefined) {
        const numericAmount = Number(payload.amount);
        if (!Number.isFinite(numericAmount) || numericAmount < 0) {
            throw new Error('Expense amount must be a valid non-negative number');
        }
        updates.amount = numericAmount;
    }
    if (payload.date !== undefined) {
        parseDateInput(payload.date);
        updates.expenseDate = new Date(`${payload.date}T00:00:00.000Z`);
    }
    const expense = await Expense.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!expense) {
        throw new Error('Expense not found');
    }
    return expense;
};

const deleteExpense = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid expense id');
    }
    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) {
        throw new Error('Expense not found');
    }
    return true;
};

const updateCashBalance = async (amount) => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        throw new Error('Cash balance must be a valid non-negative number');
    }
    const cashAccount = await ensureCashAccount();
    cashAccount.balance = numericAmount;
    await cashAccount.save();
    return round3(cashAccount.balance);
};

const addOtherTransaction = async (data) => {
    const { date, name, description, type, grams, amount } = data;
    console.log('addOtherTransaction received data:', data);
    if (!date || !name || !type) {
        console.error('addOtherTransaction validation failed: missing fields');
        throw new Error('Date, Name, and Type are required');
    }
    const d = new Date(date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    console.log('Computed month for transaction (local):', month);
    try {
        const transaction = await OtherTransaction.create({
            date,
            name,
            description,
            type,
            grams: Number(grams) || 0,
            amount: Number(amount) || 0,
            month
        });
        console.log('OtherTransaction created successfully:', transaction._id);
        return transaction;
    } catch (error) {
        console.error('Error creating OtherTransaction in service:', error);
        throw error;
    }
};

const deleteOtherTransaction = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid transaction id');
    }
    const transaction = await OtherTransaction.findByIdAndDelete(id);
    if (!transaction) {
        throw new Error('Transaction not found');
    }
    return true;
};

module.exports = {
    getBillingSummary,
    getMonthlyBillingSummary,
    getExpensesByDate,
    createExpense,
    updateExpense,
    deleteExpense,
    updateCashBalance,
    addOtherTransaction,
    deleteOtherTransaction
};
