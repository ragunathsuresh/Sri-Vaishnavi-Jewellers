const GoldRate = require('../models/GoldRate');
const Stock = require('../models/Stock');
const Sale = require('../models/Sale');
const Account = require('../models/Account');

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

        // 1. Fetch real accounts (no dummy seeding)
        let accounts = await Account.find();

        // 2. Stocks Summary — active items only (currentCount > 0)
        const allStocks = await Stock.find();
        const activeStocks = allStocks.filter(s => (s.currentCount || 0) > 0);

        const metalTypes = [
            { name: 'Gold 22k', filter: (s) => s.jewelleryType === 'Gold' && s.purity === '22K (916)' },
            { name: 'Gold 18k', filter: (s) => s.jewelleryType === 'Gold' && s.purity === '18K (750)' },
            { name: 'Silver', filter: (s) => s.jewelleryType === 'Silver' },
            { name: 'Diamond', filter: (s) => s.jewelleryType === 'Diamond' }
        ];

        const stocksSummary = metalTypes.map(metal => {
            const currentStock = activeStocks.filter(metal.filter);
            const totalCount = currentStock.reduce((acc, s) => acc + (s.currentCount || 0), 0);
            const totalWeight = currentStock.reduce((acc, s) => acc + ((s.netWeight || 0) * (s.currentCount || 1)), 0);

            return {
                type: metal.name,
                openingWt: totalWeight * 0.98, // Keep simple mock for agora
                inwardWt: totalWeight * 0.05,  // Keep simple mock
                salesWt: totalWeight * 0.03,   // Keep simple mock
                closingWt: totalWeight,
                totalCount: totalCount
            };
        });

        // 3. Customer Sales (Recent)
        const recentSales = await Sale.find({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ createdAt: -1 }).limit(5);

        // Global Totals — active items only
        const globalTotalItems = activeStocks.length;
        const globalTotalCount = activeStocks.reduce((acc, s) => acc + (s.currentCount || 0), 0);
        const globalTotalWeight = activeStocks.reduce((acc, s) => acc + ((s.netWeight || 0) * (s.currentCount || 1)), 0);

        res.status(200).json({
            success: true,
            data: {
                stocksSummary,
                assetsAndCash: accounts,
                totalItems: globalTotalItems,
                totalCount: globalTotalCount,
                totalWeight: globalTotalWeight.toFixed(3),
                customerSales: recentSales.map(sale => ({
                    billNo: `#${sale._id.toString().slice(-4).toUpperCase()}`,
                    customerName: sale.customerDetails.name,
                    issuedItems: sale.issuedItems.map(i => ({ name: i.itemName, weight: i.weight, amount: i.paidAmount })),
                    receiptItems: sale.receiptItems.map(r => ({ type: r.receiptType, weight: r.weight, value: r.value })),
                    totalAmount: sale.totalIssuedValue
                })),
                totalDailySales: recentSales.reduce((acc, s) => acc + s.totalIssuedValue, 0)
            }
        });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get current gold rate
// @route   GET /api/dashboard/gold-rate
// @access  Private
const getGoldRate = async (req, res) => {
    try {
        let goldRate = await GoldRate.findOne().sort({ date: -1, createdAt: -1 });

        if (!goldRate) {
            // Initial rate if none exists
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            goldRate = await GoldRate.create({ rate: 6250, date: today });
        }

        res.status(200).json({
            success: true,
            data: goldRate
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update gold rate
// @route   POST /api/dashboard/gold-rate
// @access  Private (Admin)
const updateGoldRate = async (req, res) => {
    try {
        const { rate, date } = req.body;

        const parsedRate = Number(rate);
        if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
            return res.status(400).json({ success: false, message: 'Please provide a rate' });
        }

        const parsedDate = date ? new Date(date) : new Date();
        parsedDate.setHours(0, 0, 0, 0);

        const goldRate = await GoldRate.create({ rate: parsedRate, date: parsedDate });

        res.status(201).json({
            success: true,
            data: goldRate
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getGoldRate,
    updateGoldRate
};
