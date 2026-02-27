const LineStock = require('../models/LineStock');
const Stock = require('../models/Stock');
const LineStockSale = require('../models/LineStockSale');
const Dealer = require('../models/Dealer');
const DealerTransaction = require('../models/DealerTransaction');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Helper to generate Line Number
const generateLineNumber = async () => {
    const lastRecord = await LineStock.findOne().sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastRecord && lastRecord.lineNumber) {
        const lastNum = parseInt(lastRecord.lineNumber.split('-')[1]);
        nextNum = lastNum + 1;
    }
    return `LS-${nextNum.toString().padStart(4, '0')}`;
};

// Helper to generate Invoice Number
const generateInvoiceNumber = async () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const randomPart = crypto.randomInt(1000, 10000);
    return `INV-LS-${yyyy}${mm}${dd}${hh}${mi}${ss}-${randomPart}`;
};

// @desc    Create new Line Stock
// @route   POST /api/line-stock
// @access  Private
exports.createLineStock = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { personName, phoneNumber, issuedDate, expectedReturnDate, items, totalValue } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'No items provided' });
        }

        const lineNumber = await generateLineNumber();
        const manualTotalValue = Number(totalValue);
        const hasManualTotalValue = Number.isFinite(manualTotalValue) && manualTotalValue >= 0;
        let totalIssued = 0;
        const processedItems = [];

        for (const item of items) {
            const stock = await Stock.findById(item.productId).session(session);
            if (!stock) {
                throw new Error(`Product not found: ${item.productId}`);
            }

            if (stock.currentCount < item.issuedQty) {
                throw new Error(`Insufficient stock for ${stock.itemName}. Available: ${stock.currentCount}`);
            }

            // Deduct stock
            stock.currentCount -= item.issuedQty;
            await stock.save({ session });

            const itemValue = item.issuedQty * (stock.sellingPrice || 0);
            totalIssued += itemValue;

            processedItems.push({
                productId: stock._id,
                productName: stock.itemName,
                issuedQty: item.issuedQty,
                totalIssuedValue: itemValue
            });
        }

        const lineStock = new LineStock({
            lineNumber,
            personName,
            phoneNumber,
            issuedDate: issuedDate ? new Date(issuedDate) : Date.now(),
            expectedReturnDate,
            items: processedItems,
            totals: {
                issued: hasManualTotalValue ? manualTotalValue : totalIssued,
                manualValue: hasManualTotalValue ? manualTotalValue : 0
            }
        });

        await lineStock.save({ session });

        // Update dealer running balance: dealer owes us the issued gram amount
        const issuedGrams = Number(lineStock.totals?.issued ?? 0);
        if (issuedGrams > 0 && personName) {
            const nameRegex = new RegExp(`^${personName.trim()}$`, 'i');
            let dealer = await Dealer.findOne({ name: nameRegex, dealerType: 'Line Stocker' }).session(session);

            if (dealer) {
                dealer.runningBalance = Number((dealer.runningBalance + issuedGrams).toFixed(3));
                await dealer.save({ session });
            } else {
                // New person: create a dealer entry
                const created = await Dealer.create([{
                    name: personName.trim(),
                    phoneNumber: phoneNumber || '',
                    runningBalance: Number(issuedGrams.toFixed(3)),
                    balanceType: 'Dealer Owes Us',
                    dealerType: 'Line Stocker'
                }], { session });
                dealer = created[0];
            }

            // Log Transaction for Billing/History
            const now = new Date();
            const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
            const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            await DealerTransaction.create([{
                dealerId: dealer._id,
                transactionType: 'Line Stock Issuance',
                totalValue: issuedGrams,
                balanceAfter: dealer.runningBalance,
                date: dateStr,
                time: timeStr,
                items: processedItems.map(item => ({
                    itemName: item.productName,
                    quantity: item.issuedQty,
                    netWeight: 0, // grams are handled via totalValue/balanceAfter
                }))
            }], { session });
        }

        await session.commitTransaction();
        session.endSession();

        res.status(201).json(lineStock);
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        res.status(400).json({ message: error.message });
    }
};

// @desc    Create manual Line Stock record (for overdue/completed balances)
// @route   POST /api/line-stock/manual
// @access  Private
exports.createManualLineStock = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { personName, phoneNumber, status, expectedReturnDate, issuedDate, totalValue } = req.body;

        const lineNumber = await generateLineNumber();
        const value = Number(totalValue) || 0;

        // 1. Create/Update Dealer (Account)
        const nameRegex = new RegExp(`^${personName.trim()}$`, 'i');
        let dealer = await Dealer.findOne({ name: nameRegex, dealerType: 'Line Stocker' }).session(session);

        if (dealer) {
            dealer.runningBalance = value;
            dealer.balanceType = value >= 0 ? 'Dealer Owes Us' : 'We Owe Dealer';
            if (phoneNumber) dealer.phoneNumber = phoneNumber;
            dealer.dealerType = 'Line Stocker';
            await dealer.save({ session });
        } else {
            const created = await Dealer.create([{
                name: personName.trim(),
                phoneNumber: phoneNumber || '',
                runningBalance: value,
                balanceType: value >= 0 ? 'Dealer Owes Us' : 'We Owe Dealer',
                dealerType: 'Line Stocker'
            }], { session });
            dealer = created[0];
        }

        // 2. Log Transaction for Audit
        const now = new Date();
        const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        await DealerTransaction.create([{
            dealerId: dealer._id,
            transactionType: 'Opening Balance',
            totalValue: value,
            balanceAfter: dealer.runningBalance,
            date: dateStr,
            time: timeStr
        }], { session });

        // 3. Create LineStock Record (UI entry)
        const lineStock = new LineStock({
            lineNumber,
            personName,
            phoneNumber,
            issuedDate: issuedDate ? new Date(issuedDate) : null,
            expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : (issuedDate ? new Date(issuedDate) : new Date()),
            status: (status || 'ISSUED').toUpperCase(),
            items: [],
            totals: {
                issued: value,
                sold: 0,
                returned: 0,
                manualValue: value
            }
        });

        await lineStock.save({ session });
        await session.commitTransaction();
        session.endSession();

        res.status(201).json(lineStock);
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        console.error('Manual line stock error:', error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all Line Stocks with pagination and filters
// @route   GET /api/line-stock
// @access  Private
exports.getLineStocks = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status, startDate, endDate } = req.query;

        // Auto-mark OVERDUE
        const now = new Date();
        await LineStock.updateMany(
            {
                status: 'ISSUED',
                expectedReturnDate: { $lt: now }
            },
            { $set: { status: 'OVERDUE' } }
        );

        const query = {};

        if (search) {
            query.$or = [
                { lineNumber: { $regex: search, $options: 'i' } },
                { personName: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } }
            ];
        }

        if (status) {
            query.status = status;
        }

        if (startDate || endDate) {
            query.issuedDate = {};
            if (startDate) query.issuedDate.$gte = new Date(startDate);
            if (endDate) query.issuedDate.$lte = new Date(endDate);
        }

        const total = await LineStock.countDocuments(query);
        const lineStocks = await LineStock.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        // Fetch dealer balances to include in response
        const dealers = await Dealer.find({ dealerType: 'Line Stocker' }, 'name runningBalance');
        const balanceMap = {};
        dealers.forEach((d) => {
            const key = (d.name || '').trim().toLowerCase();
            if (key) balanceMap[key] = Number(d.runningBalance ?? 0);
        });

        const lineStocksWithBalance = lineStocks.map(ls => {
            const obj = ls.toObject();
            const nameKey = (ls.personName || '').trim().toLowerCase();
            obj.dealerBalance = balanceMap.hasOwnProperty(nameKey) ? balanceMap[nameKey] : 0;
            return obj;
        });

        res.json({
            lineStocks: lineStocksWithBalance,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Line Stock receivables (issued + overdue)
// @route   GET /api/line-stock/receivable
// @access  Private
exports.getLineStockReceivables = async (req, res) => {
    try {
        // 1. Keep OVERDUE status in sync
        const now = new Date();
        await LineStock.updateMany(
            { status: 'ISSUED', expectedReturnDate: { $lt: now } },
            { $set: { status: 'OVERDUE' } }
        );

        const activeLineStocks = await LineStock.find({ status: { $in: ['ISSUED', 'OVERDUE'] } });

        // 2. Fetch all dealers who are Line Stockers
        const allLineStockers = await Dealer.find({ dealerType: 'Line Stocker' });

        // 3. Build a map of active statuses per person
        const statusMap = {};
        activeLineStocks.forEach(r => {
            const key = (r.personName || '').trim().toLowerCase();
            if (!statusMap[key] || r.status === 'OVERDUE') {
                statusMap[key] = r.status;
            }
        });

        // 4. Combine: Every Line Stocker dealer is a receivable entry
        const data = allLineStockers.map(dealer => {
            const key = (dealer.name || '').trim().toLowerCase();
            return {
                personName: dealer.name,
                phoneNumber: dealer.phoneNumber,
                status: statusMap[key] || 'ACTIVE',
                outstandingBalance: Number((dealer.runningBalance || 0).toFixed(3)),
                dealerId: dealer._id
            };
        });

        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Line Stock by ID
// @route   GET /api/line-stock/:id
// @access  Private
exports.getLineStockById = async (req, res) => {
    try {
        const lineStock = await LineStock.findById(req.params.id).populate('items.productId');
        if (!lineStock) {
            return res.status(404).json({ message: 'Line Stock not found' });
        }
        res.json(lineStock);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Settle Line Stock
// @route   PUT /api/line-stock/settle/:id
// @access  Private
exports.settleLineStock = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { items } = req.body; // Array of { productId, soldQty, value }

        const lineStock = await LineStock.findById(id).session(session);
        if (!lineStock) {
            throw new Error('Line Stock not found');
        }

        const isAlreadySettled = lineStock.status === 'SETTLED' || lineStock.status === 'CLOSED';

        let totalSold = Number(lineStock.totals?.sold || 0);
        let totalReturned = 0;

        for (const updateItem of items) {
            let itemIndex = lineStock.items.findIndex(i => i.productId.toString() === updateItem.productId.toString());
            let item;

            if (itemIndex === -1) {
                // New item being added manually during settlement
                const stock = await Stock.findById(updateItem.productId).session(session);
                if (!stock) throw new Error('Product not found for manual addition');

                lineStock.items.push({
                    productId: stock._id,
                    productName: stock.itemName,
                    issuedQty: Number(updateItem.issuedQty) || 0,
                    soldQty: Number(updateItem.soldQty) || 0,
                    returnedQty: (Number(updateItem.issuedQty) || 0) - (Number(updateItem.soldQty) || 0),
                    totalIssuedValue: 0,
                    totalSoldValue: 0,
                    totalReturnedValue: 0
                });
                itemIndex = lineStock.items.length - 1;
            }

            item = lineStock.items[itemIndex];
            const enteredValue = Number(updateItem.value);
            const hasEnteredValue = Number.isFinite(enteredValue) && enteredValue >= 0;

            if (!isAlreadySettled) {
                // If it was manually added above, we already set sold/issued. 
                // If it existed, we update it.
                if (itemIndex !== -1 && item.issuedQty > 0) {
                    // Check bounds for existing items
                    if (updateItem.soldQty > item.issuedQty) {
                        throw new Error(`Sold quantity cannot exceed issued quantity for ${item.productName}`);
                    }
                    item.soldQty = updateItem.soldQty;
                    item.returnedQty = item.issuedQty - item.soldQty;
                } else if (itemIndex !== -1 && item.issuedQty === 0) {
                    // This was a manual record created without products
                    // We allow setting issued/sold freely here
                    item.issuedQty = Number(updateItem.issuedQty) || 0;
                    item.soldQty = Number(updateItem.soldQty) || 0;
                    item.returnedQty = item.issuedQty - item.soldQty;
                }
            }

            const stock = await Stock.findById(item.productId).session(session);
            if (!isAlreadySettled && !stock) {
                throw new Error(`Product not found for settlement: ${item.productName}`);
            }

            if (!isAlreadySettled && stock) {
                // Add returned qty back to Stock
                if (item.returnedQty > 0) {
                    stock.currentCount += item.returnedQty;
                    await stock.save({ session });
                }

                item.totalSoldValue = item.soldQty * (stock.sellingPrice || 0);
                totalSold += item.totalSoldValue;
            }

            const fallbackReturnedValue = item.returnedQty * (stock?.sellingPrice || 0);
            item.totalReturnedValue = hasEnteredValue ? enteredValue : fallbackReturnedValue;
            totalReturned += item.totalReturnedValue;

            // Create Sales entry if soldQty > 0
            if (!isAlreadySettled && stock && item.soldQty > 0) {
                const invoiceNumber = await generateInvoiceNumber();
                const sale = new LineStockSale({
                    invoiceNumber,
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.soldQty,
                    price: stock.sellingPrice || 0,
                    lineStockId: lineStock._id
                });
                await sale.save({ session });
            }
        }

        lineStock.totals.sold = totalSold;
        lineStock.totals.returned = totalReturned;
        if (!isAlreadySettled) {
            lineStock.status = 'SETTLED'; // or 'CLOSED' based on logic, prompt says "SETTLED or CLOSED"
        }

        await lineStock.save({ session });

        // Update dealer running balance: remove the weight of items returned to main stock
        const returnedGrams = Number(totalReturned) || 0;
        if (returnedGrams > 0 && lineStock.personName) {
            const nameRegex = new RegExp(`^${lineStock.personName.trim()}$`, 'i');
            const dealer = await Dealer.findOne({ name: nameRegex, dealerType: 'Line Stocker' }).session(session);
            if (dealer) {
                dealer.runningBalance = Number((dealer.runningBalance - returnedGrams).toFixed(3));
                await dealer.save({ session });

                // Log Transaction
                const now = new Date();
                const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
                const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
                await DealerTransaction.create([{
                    dealerId: dealer._id,
                    transactionType: 'Line Stock Settlement',
                    totalValue: returnedGrams,
                    balanceAfter: dealer.runningBalance,
                    date: dateStr,
                    time: timeStr,
                    items: lineStock.items.map(item => ({
                        itemName: item.productName,
                        quantity: item.returnedQty,
                        netWeight: item.returnedQty > 0 ? returnedGrams : 0
                    }))
                }], { session });
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.json(lineStock);
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        res.status(400).json({ message: error.message });
    }
};
// @desc    Delete all line stock records for a person
// @route   DELETE /api/line-stock
// @access  Private
exports.deletePersonLineStocks = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { personName, phoneNumber } = req.query;
        console.log(`Deleting line stocks and associated dealer for: ${personName} (${phoneNumber})`);
        if (!personName) {
            return res.status(400).json({ message: 'Person name is required' });
        }

        const nameRegex = new RegExp(`^${personName.trim()}$`, 'i');
        const query = { personName: nameRegex };
        if (phoneNumber) {
            query.phoneNumber = phoneNumber;
        } else {
            query.$or = [{ phoneNumber: '' }, { phoneNumber: null }, { phoneNumber: { $exists: false } }];
        }

        // 1. Delete LineStock records
        const result = await LineStock.deleteMany(query).session(session);
        console.log(`Deleted ${result.deletedCount} line stock records`);

        // 2. Find and delete Dealer record
        const dealer = await Dealer.findOne({ name: nameRegex }).session(session);
        if (dealer) {
            const dealerId = dealer._id;
            await Dealer.findByIdAndDelete(dealerId).session(session);
            await DealerTransaction.deleteMany({ dealerId }).session(session);
            console.log(`Deleted dealer ${dealerId} and its transactions`);
        }

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ success: true, message: 'Line stock records and associated dealer deleted successfully' });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error('Delete line stock error:', error);
        res.status(500).json({ message: error.message });
    }
};
