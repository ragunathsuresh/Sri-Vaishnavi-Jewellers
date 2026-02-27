const Dealer = require('../models/Dealer');
const DealerTransaction = require('../models/DealerTransaction');
const Stock = require('../models/Stock');
const mongoose = require('mongoose');

const toThreeDecimals = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Number(parsed.toFixed(3));
};

// @desc    Get all dealers
// @route   GET /api/dealers
// @access  Private
const getDealers = async (req, res) => {
    try {
        const { type } = req.query;
        const query = (type === 'Line Stocker')
            ? { dealerType: 'Line Stocker' }
            : { dealerType: { $ne: 'Line Stocker' } };
        const dealers = await Dealer.find(query).sort({ name: 1 });
        res.status(200).json({ success: true, data: dealers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get dealer by ID
// @route   GET /api/dealers/:id
// @access  Private
const getDealerById = async (req, res) => {
    try {
        const dealer = await Dealer.findById(req.params.id);
        if (!dealer) {
            return res.status(404).json({ success: false, message: 'Dealer not found' });
        }
        res.status(200).json({ success: true, data: dealer });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Set or edit opening balance
// @route   POST /api/dealers/opening-balance
// @access  Private
const setOpeningBalance = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { dealerId, netBalance, balanceType, date, time } = req.body;

        let dealer;
        if (dealerId) {
            dealer = await Dealer.findById(dealerId).session(session);
            if (!dealer) throw new Error('Dealer not found');
            dealer.runningBalance = netBalance;
            dealer.balanceType = balanceType;
            await dealer.save({ session });
        } else {
            // If no dealerId, check if dealer exists by name (case-insensitive)
            const { name, phoneNumber, dealerType: dType } = req.body;
            const targetType = dType || 'Dealer';
            const nameRegex = new RegExp(`^${name.trim()}$`, 'i');

            // Inclusive lookup: if searching for 'Dealer', also match records where field is missing
            const lookupQuery = (targetType === 'Line Stocker')
                ? { name: nameRegex, dealerType: 'Line Stocker' }
                : { name: nameRegex, dealerType: { $ne: 'Line Stocker' } };

            dealer = await Dealer.findOne(lookupQuery).session(session);

            if (dealer) {
                // Update existing dealer
                dealer.runningBalance = netBalance;
                dealer.balanceType = balanceType;
                if (targetType) dealer.dealerType = targetType;
                if (phoneNumber) dealer.phoneNumber = phoneNumber;
                await dealer.save({ session });
            } else {
                // Create new dealer
                const created = await Dealer.create([{
                    name: name.trim(),
                    phoneNumber: phoneNumber || '',
                    runningBalance: netBalance,
                    balanceType,
                    dealerType: targetType || 'Dealer'
                }], { session });
                dealer = created[0];
            }
        }

        // Log transaction
        await DealerTransaction.create([{
            dealerId: dealer._id,
            transactionType: 'Opening Balance',
            totalValue: netBalance,
            balanceAfter: dealer.runningBalance,
            date,
            time,
            items: []
        }], { session });

        await session.commitTransaction();
        res.status(200).json({ success: true, data: dealer });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

const addDealerStock = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {
            dealerId,
            dealerName,
            items = [],
            date,
            time,
            currentBalance,
            dealerPurchaseCost,
            actionType = 'both'
        } = req.body;

        const shouldSaveStock = actionType === 'both' || actionType === 'stockOnly';
        const shouldSaveTransaction = actionType === 'both' || actionType === 'transactionOnly';

        const incomingItems = Array.isArray(items) ? items : [];
        const sanitizedItems = incomingItems
            .map((item) => ({
                ...item,
                serialNo: String(item.serialNo || '').trim(),
                itemName: String(item.itemName || '').trim(),
                jewelName: String(item.jewelName || item.itemName || '').trim(),
                quantity: parseInt(item.quantity, 10) || 0,
                grossWeight: parseFloat(item.grossWeight) || 0,
                netWeight: parseFloat(item.netWeight) || 0
            }))
            .filter((item) => item.serialNo && item.itemName && item.quantity > 0 && item.grossWeight > 0 && item.netWeight > 0);

        let dealer;
        if (dealerId) {
            dealer = await Dealer.findById(dealerId).session(session);
            if (!dealer) throw new Error('Dealer not found');
        } else if (dealerName) {
            // Check if dealer already exists by name
            dealer = await Dealer.findOne({ name: dealerName }).session(session);
            if (!dealer) {
                // Create new dealer
                const newDealers = await Dealer.create([{
                    name: dealerName,
                    phoneNumber: req.body.phoneNumber || '9876543210', // Default if not provided
                    runningBalance: 0,
                    balanceType: 'Dealer Owes Us'
                }], { session });
                dealer = newDealers[0];
            }
        } else {
            throw new Error('Dealer ID or Name is required');
        }

        if (shouldSaveStock) {
            if (sanitizedItems.length === 0) {
                throw new Error('Please add at least one valid item to save stock details');
            }

            for (const item of sanitizedItems) {
                let stock = await Stock.findOne({
                    serialNo: { $regex: new RegExp(`^${item.serialNo}$`, 'i') }
                }).session(session);

                if (stock) {
                    // Update existing stock
                    stock.currentCount += parseInt(item.quantity);
                    stock.purchaseCount += parseInt(item.quantity);
                    stock.itemName = item.itemName;
                    stock.jewelName = item.jewelName || item.itemName;
                    stock.category = item.category;
                    stock.jewelleryType = item.jewelleryType;
                    stock.grossWeight = item.grossWeight;
                    stock.netWeight = item.netWeight;
                    stock.purity = item.purity;
                    await stock.save({ session });
                } else {
                    // Create new stock
                    await Stock.create([{
                        serialNo: item.serialNo,
                        itemName: item.itemName,
                        jewelName: item.jewelName || item.itemName,
                        jewelleryType: item.jewelleryType,
                        category: item.category,
                        grossWeight: item.grossWeight,
                        netWeight: item.netWeight,
                        purity: item.purity,
                        currentCount: item.quantity,
                        purchaseCount: item.quantity,
                        supplierName: dealer.name,
                        date: new Date(date),
                        time: time
                    }], { session });
                }
            }
        }

        if (shouldSaveTransaction) {
            const current = toThreeDecimals(currentBalance);
            const totalGram = toThreeDecimals(req.body.totalGramPurchase);
            const sriBill = toThreeDecimals(req.body.sriBill);
            const userPurchase = toThreeDecimals((totalGram * sriBill) / 100);
            const dealerPurchase = toThreeDecimals(dealerPurchaseCost);

            // Business rule:
            // Gross Balance = Current Balance - Today purchase by user + Today purchase by dealer
            const grossBalance = toThreeDecimals(current - userPurchase + dealerPurchase);
            const netTransactionValue = toThreeDecimals(userPurchase - dealerPurchase);

            dealer.runningBalance = grossBalance;
            dealer.balanceType = dealer.runningBalance >= 0 ? 'Dealer Owes Us' : 'We Owe Dealer';
            await dealer.save({ session });

            // Log transaction
            await DealerTransaction.create([{
                dealerId: dealer._id,
                transactionType: 'Stock In',
                items: sanitizedItems,
                totalGramPurchase: totalGram,
                sriBill,
                userPurchaseGrams: userPurchase,
                dealerPurchaseGrams: dealerPurchase,
                totalValue: netTransactionValue,
                balanceAfter: dealer.runningBalance,
                date,
                time
            }], { session });
        }

        await session.commitTransaction();
        res.status(200).json({
            success: true,
            data: dealer,
            message: shouldSaveStock && shouldSaveTransaction
                ? 'Stock and transaction saved successfully'
                : shouldSaveStock
                    ? 'Stock details saved successfully'
                    : 'Transaction saved successfully'
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message || 'Transaction failed' });
    } finally {
        session.endSession();
    }
};

// @desc    Get item details by serial number
// @route   GET /api/dealers/item/:serialNo
// @access  Private
const getItemDetails = async (req, res) => {
    try {
        const stock = await Stock.findOne({ serialNo: req.params.serialNo });
        if (!stock) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        res.status(200).json({ success: true, data: stock });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all dealer transactions
// @route   GET /api/dealers/transactions
// @access  Private
const getDealerTransactions = async (req, res) => {
    try {
        const transactions = await DealerTransaction.find()
            .populate('dealerId', 'name phoneNumber')
            .sort({ createdAt: -1 });

        const data = transactions.map((txn) => ({
            _id: txn._id,
            transactionType: txn.transactionType,
            name: txn.dealerId?.name || '-',
            phoneNumber: txn.dealerId?.phoneNumber || '-',
            date: txn.date,
            time: txn.time,
            amount: Number(txn.totalValue || 0),
            balanceAfter: Number(txn.balanceAfter || 0)
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete a dealer
// @route   DELETE /api/dealers/:id
// @access  Private
const deleteDealer = async (req, res) => {
    try {
        console.log(`Deleteting dealer: ${req.params.id}`);
        const dealer = await Dealer.findByIdAndDelete(req.params.id);
        if (!dealer) {
            return res.status(404).json({ success: false, message: 'Dealer not found' });
        }

        // Also delete transactions
        const result = await DealerTransaction.deleteMany({ dealerId: req.params.id });
        console.log(`Deleted ${result.deletedCount} transactions for dealer ${req.params.id}`);

        res.status(200).json({ success: true, message: 'Dealer deleted successfully' });
    } catch (error) {
        console.error('Delete dealer error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getDealers,
    getDealerById,
    setOpeningBalance,
    addDealerStock,
    getItemDetails,
    getDealerTransactions,
    deleteDealer
};
