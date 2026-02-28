const ChitFund = require('../models/ChitFund');
const GoldRate = require('../models/GoldRate');

const getCurrentGoldRate = async () => {
    let rateDoc = await GoldRate.findOne().sort({ date: -1, createdAt: -1 });
    if (!rateDoc) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        rateDoc = await GoldRate.create({ date: today, rate: 6250 });
    }
    return rateDoc;
};

const parsePositiveNumber = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
};

const buildListFilter = ({ search, startDate, endDate }) => {
    const filter = {};

    if (search) {
        const searchRegex = new RegExp(search.trim(), 'i');
        filter.$or = [{ customerName: searchRegex }, { phoneNumber: searchRegex }];
    }

    if (startDate || endDate) {
        filter.date = {};
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            filter.date.$gte = start;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.date.$lte = end;
        }
    }

    return filter;
};

// @desc    Get current configured gold rate
// @route   GET /api/chit-funds/today-rate
// @access  Private
const getTodayRate = async (req, res) => {
    try {
        const goldRate = await getCurrentGoldRate();
        res.status(200).json({
            success: true,
            data: {
                rate: goldRate.rate,
                date: goldRate.date
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Search existing chit customers
// @route   GET /api/chit-funds/customers/search?query=...
// @access  Private
const searchChitCustomers = async (req, res) => {
    try {
        const query = String(req.query.query || '').trim();
        if (!query) {
            return res.status(200).json({ success: true, data: [] });
        }

        const searchRegex = new RegExp(query, 'i');

        // 1. Find all records matching the search text
        const matchedPhones = await ChitFund.find({
            $or: [
                { customerName: searchRegex },
                { phoneNumber: searchRegex }
            ]
        }).distinct('phoneNumber');

        if (!matchedPhones || matchedPhones.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        // 2. Sum ALL transactions for those phone numbers
        const finalRows = await ChitFund.aggregate([
            {
                $match: {
                    phoneNumber: { $in: matchedPhones }
                }
            },
            {
                $group: {
                    _id: '$phoneNumber',
                    customerName: { $first: '$customerName' },
                    phoneNumber: { $first: '$phoneNumber' },
                    totalAmount: { $sum: '$amount' },
                    totalGrams: { $sum: '$gramsPurchased' },
                    lastTransaction: { $max: '$createdAt' }
                }
            },
            { $sort: { lastTransaction: -1 } },
            { $limit: 10 }
        ]);

        return res.status(200).json({ success: true, data: finalRows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete all chit fund records for a specific customer (by phone)
// @route   DELETE /api/chit-funds/customers/:phone
// @access  Private
const deleteChitCustomerHistory = async (req, res) => {
    try {
        const { phone } = req.params;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        const result = await ChitFund.deleteMany({ phoneNumber: phone });

        return res.status(200).json({
            success: true,
            message: `Deleted ${result.deletedCount} records for customer.`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create chit fund entry
// @route   POST /api/chit-funds
// @access  Private
const createChitFund = async (req, res) => {
    try {
        const {
            customerName,
            phoneNumber,
            date,
            time,
            amount,
            gramsPurchased,
            isPastEntry,
            goldRateToday,
            rateApplied
        } = req.body;

        if (!customerName || !String(customerName).trim()) {
            return res.status(400).json({ success: false, message: 'Customer name is required' });
        }

        if (!/^\d{10}$/.test(String(phoneNumber || ''))) {
            return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits' });
        }

        const parsedAmount = parsePositiveNumber(amount);
        if (!parsedAmount) {
            return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
        }

        const goldRateDoc = await getCurrentGoldRate();
        const resolvedGoldRateToday = goldRateToday == null ? goldRateDoc.rate : parsePositiveNumber(goldRateToday);
        if (!resolvedGoldRateToday) {
            return res.status(400).json({ success: false, message: 'Gold rate today must be a positive number' });
        }

        const isManualPastEntry = Boolean(isPastEntry);
        let resolvedRateApplied = rateApplied == null ? resolvedGoldRateToday : parsePositiveNumber(rateApplied);
        let resolvedGrams = parsePositiveNumber(gramsPurchased);
        if (isManualPastEntry && !resolvedGrams) {
            return res.status(400).json({ success: false, message: 'Grams purchased must be a positive number for past entry' });
        }

        if (resolvedGrams) {
            resolvedGrams = Number(resolvedGrams.toFixed(6));
            if (!resolvedRateApplied) {
                resolvedRateApplied = Number((parsedAmount / resolvedGrams).toFixed(6));
            }
        } else if (!resolvedRateApplied) {
            return res.status(400).json({ success: false, message: 'Rate applied must be a positive number' });
        }

        const payload = {
            customerName: String(customerName).trim(),
            phoneNumber: String(phoneNumber).trim(),
            date: date ? new Date(date) : new Date(),
            time: String(time || '').trim(),
            amount: parsedAmount,
            isPastEntry: isManualPastEntry,
            goldRateToday: resolvedGoldRateToday,
            rateApplied: resolvedRateApplied,
            gramsPurchased: resolvedGrams
        };

        const created = await ChitFund.create(payload);

        res.status(201).json({
            success: true,
            message: 'Chit entry created successfully',
            data: created
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((item) => item.message).join(', ');
            return res.status(400).json({ success: false, message: messages });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Fetch all chit fund entries
// @route   GET /api/chit-funds
// @access  Private
const getChitFunds = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const skip = (page - 1) * limit;

        const filter = buildListFilter({
            search: req.query.search,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        });

        const [rows, total, totalAmountResult] = await Promise.all([
            ChitFund.find(filter).sort({ createdAt: -1, serialNumber: -1 }).skip(skip).limit(limit),
            ChitFund.countDocuments(filter),
            ChitFund.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        totalAmount: {
                            $sum: { $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } }
                        },
                        totalGrams: {
                            $sum: { $convert: { input: '$gramsPurchased', to: 'double', onError: 0, onNull: 0 } }
                        }
                    }
                }
            ])
        ]);
        const totalAmount = Number(totalAmountResult?.[0]?.totalAmount || 0);
        const totalGrams = Number(totalAmountResult?.[0]?.totalGrams || 0);

        res.status(200).json({
            success: true,
            data: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1
            },
            summary: {
                totalAmount,
                totalGrams
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Fetch single chit fund entry
// @route   GET /api/chit-funds/:id
// @access  Private
const getChitFundById = async (req, res) => {
    try {
        const row = await ChitFund.findById(req.params.id);
        if (!row) {
            return res.status(404).json({ success: false, message: 'Chit fund entry not found' });
        }
        res.status(200).json({ success: true, data: row });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update chit fund entry
// @route   PUT /api/chit-funds/:id
// @access  Private
const updateChitFund = async (req, res) => {
    try {
        const existing = await ChitFund.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Chit fund entry not found' });
        }

        const {
            customerName,
            phoneNumber,
            date,
            time,
            amount,
            gramsPurchased,
            isPastEntry,
            goldRateToday,
            rateApplied
        } = req.body;

        if (customerName !== undefined) existing.customerName = String(customerName).trim();
        if (phoneNumber !== undefined) existing.phoneNumber = String(phoneNumber).trim();
        if (date !== undefined) existing.date = new Date(date);
        if (time !== undefined) existing.time = String(time || '').trim();

        if (amount !== undefined) {
            const parsedAmount = parsePositiveNumber(amount);
            if (!parsedAmount) {
                return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
            }
            existing.amount = parsedAmount;
        }
        if (isPastEntry !== undefined) existing.isPastEntry = Boolean(isPastEntry);

        if (goldRateToday !== undefined) {
            const parsedGoldRate = parsePositiveNumber(goldRateToday);
            if (!parsedGoldRate) {
                return res.status(400).json({ success: false, message: 'Gold rate today must be a positive number' });
            }
            existing.goldRateToday = parsedGoldRate;
        }

        if (rateApplied !== undefined) {
            const parsedRateApplied = parsePositiveNumber(rateApplied);
            if (!parsedRateApplied) {
                return res.status(400).json({ success: false, message: 'Rate applied must be a positive number' });
            }
            existing.rateApplied = parsedRateApplied;
        }
        if (gramsPurchased !== undefined) {
            const parsedGrams = parsePositiveNumber(gramsPurchased);
            if (!parsedGrams) {
                return res.status(400).json({ success: false, message: 'Grams purchased must be a positive number' });
            }
            existing.gramsPurchased = parsedGrams;
        }

        const saved = await existing.save();

        res.status(200).json({
            success: true,
            message: 'Chit entry updated successfully',
            data: saved
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((item) => item.message).join(', ');
            return res.status(400).json({ success: false, message: messages });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete chit fund entry
// @route   DELETE /api/chit-funds/:id
// @access  Private
const deleteChitFund = async (req, res) => {
    try {
        const row = await ChitFund.findById(req.params.id);
        if (!row) {
            return res.status(404).json({ success: false, message: 'Chit fund entry not found' });
        }

        await row.deleteOne();
        return res.status(200).json({ success: true, message: 'Chit entry deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createChitFund,
    getChitFunds,
    getChitFundById,
    updateChitFund,
    deleteChitFund,
    getTodayRate,
    searchChitCustomers,
    deleteChitCustomerHistory
};
