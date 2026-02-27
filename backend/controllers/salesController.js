const Sale = require('../models/Sale');
const Stock = require('../models/Stock');
const Account = require('../models/Account');

const buildReceiptSerial = () => `REF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

const resolveUniqueSerialNo = async (requestedSerialNo) => {
    const base = String(requestedSerialNo || '').trim();
    let candidate = base || buildReceiptSerial();

    for (let i = 0; i < 5; i++) {
        const exists = await Stock.exists({ serialNo: candidate });
        if (!exists) return candidate;
        candidate = base ? `${base}-${i + 1}` : buildReceiptSerial();
    }

    return buildReceiptSerial();
};

// @desc    Create new sale transaction and update stock
// @route   POST /api/sales
// @access  Private
const createSale = async (req, res) => {
    try {
        const {
            saleType,
            customerDetails,
            date,
            time,
            issuedItems,
            receiptItems
        } = req.body;

        const resolvedDate = String(date || '').trim() || new Date().toISOString().split('T')[0];
        const resolvedTime = String(time || '').trim() || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const safeReceiptItems = Array.isArray(receiptItems) ? receiptItems : [];
        const normalizedReceiptItems = safeReceiptItems.map((item) => {
            const customReceiptType = String(item.customReceiptType || '').trim();
            const receiptType = String(item.receiptType || '').trim();
            const effectiveReceiptType = receiptType === 'Other' ? customReceiptType : receiptType;
            return {
                ...item,
                customReceiptType,
                receiptType: effectiveReceiptType || receiptType
            };
        });

        // 1. Process Issued Items (Outbound) - Reduce Stock
        if (issuedItems && issuedItems.length > 0) {
            console.log(`[DEBUG] Processing ${issuedItems.length} issued items`);
            for (const item of issuedItems) {
                const serialNo = String(item.serialNo || '').trim();
                const stockItem = await Stock.findOne({
                    serialNo: { $regex: new RegExp(`^${serialNo}$`, 'i') }
                });
                if (stockItem) {
                    const purchaseCountValue = parseInt(item.purchaseCount) || 1;
                    const availableCount = Number(stockItem.currentCount || 1);

                    if (availableCount < purchaseCountValue) {
                        console.error(`[DEBUG] Insufficient stock: ${serialNo}. Avail: ${availableCount}, Req: ${purchaseCountValue}`);
                        return res.status(400).json({
                            message: `Insufficient stock for item: ${serialNo}. Available: ${availableCount}, Requested: ${purchaseCountValue}`
                        });
                    }

                    // Update to new terminology and ensure NO NaN
                    stockItem.currentCount = Math.max(0, availableCount - purchaseCountValue);

                    await stockItem.save();
                } else {
                    console.error(`[DEBUG] Stock item not found: ${serialNo}`);
                    return res.status(404).json({ message: `Stock item not found: ${serialNo}` });
                }
            }
        }

        // 2. Process Receipt Items (Inbound) - Add to Stock
        if (normalizedReceiptItems.length > 0) {
            console.log(`[DEBUG] Processing ${normalizedReceiptItems.length} receipt items`);
            for (const item of normalizedReceiptItems) {
                const effectiveReceiptType = String(item.receiptType || '').trim() || 'Customer Receipt';
                const serialNo = await resolveUniqueSerialNo(item.serialNo);
                const newStockEntry = new Stock({
                    serialNo,
                    date: resolvedDate,
                    time: resolvedTime,
                    itemName: effectiveReceiptType,
                    jewelleryType: effectiveReceiptType.includes('Gold') ? 'Gold' : 'Other',
                    category: 'Exchange',
                    designName: 'Customer Return',
                    supplierName: customerDetails?.name || '',
                    purchaseInvoiceNo: item.billNo || 'RECEIPT',
                    grossWeight: item.weight || 0,
                    stoneWeight: 0,
                    netWeight: (parseFloat(item.weight) || 0) - (parseFloat(item.less) || 0),
                    purity: item.purity || '0.000',
                    currentCount: parseInt(item.purchaseCount) || 1,
                    purchaseCount: parseInt(item.purchaseCount) || 1,
                    wastage: 0,
                    saleType: saleType // Tag as B2B or B2C
                });
                await newStockEntry.save();
            }
        }

        const safeIssuedItems = Array.isArray(issuedItems) ? issuedItems : [];
        const totalIssuedValue = safeIssuedItems.reduce((acc, item) => acc + (parseFloat(item.sriBill) || 0), 0);

        console.log(`[DEBUG] Total Issued: ${totalIssuedValue}`);

        // 3. Update Account Balances
        for (const item of safeIssuedItems) {
            if (item.paidAmount > 0) {
                const accountType = item.paymentMode === 'Cash' ? 'Cash' : 'Bank';
                await Account.findOneAndUpdate(
                    { type: accountType },
                    { $inc: { balance: item.paidAmount } }
                );
            }
        }

        const sale = new Sale({
            saleType,
            customerDetails,
            date: resolvedDate,
            time: resolvedTime,
            issuedItems: safeIssuedItems,
            receiptItems: normalizedReceiptItems,
            totalIssuedValue
        });

        const savedSale = await sale.save();
        console.log('[DEBUG] Sale saved successfully');

        res.status(201).json({
            success: true,
            message: 'Sale transaction completed and stock updated.',
            data: savedSale
        });

    } catch (error) {
        console.error('Error creating sale:', error);

        let message = 'Internal Server Error';
        if (error.code === 11000) {
            message = `Duplicate Error: A record with serial number '${Object.values(error.keyValue)[0]}' already exists.`;
        } else if (error.name === 'ValidationError') {
            message = `Validation Error: ${Object.values(error.errors).map(e => e.message).join(', ')}`;
        }

        res.status(500).json({
            success: false,
            message,
            error: error.message
        });
    }
};

// @desc    Search for existing customers from sales history
// @route   GET /api/sales/customer/search?query=...
// @access  Private
const searchCustomer = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(200).json({ data: [] });

        const searchRegex = new RegExp(query, 'i');

        const customers = await Sale.aggregate([
            {
                $match: {
                    $or: [
                        { 'customerDetails.name': searchRegex },
                        { 'customerDetails.phone': searchRegex }
                    ]
                }
            },
            {
                $group: {
                    _id: '$customerDetails.phone',
                    name: { $first: '$customerDetails.name' },
                    phone: { $first: '$customerDetails.phone' },
                    lastTransaction: { $first: '$createdAt' }
                }
            },
            { $sort: { lastTransaction: -1 } },
            { $limit: 10 }
        ]);

        res.status(200).json({ success: true, data: customers });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

const getSales = async (req, res) => {
    try {
        const { query, saleType, startDate, endDate } = req.query;
        let filter = {};

        if (query) {
            const searchRegex = new RegExp(query, 'i');
            filter.$or = [
                { 'customerDetails.name': searchRegex },
                { 'customerDetails.phone': searchRegex },
                { 'issuedItems.serialNo': searchRegex },
                { 'receiptItems.serialNo': searchRegex },
                { 'issuedItems.billNo': searchRegex },
                { 'receiptItems.billNo': searchRegex }
            ];
        }

        if (saleType && saleType !== 'All') {
            filter.saleType = saleType;
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const sales = await Sale.find(filter).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: sales.length, data: sales });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

const getSaleById = async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id);
        if (!sale) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        res.status(200).json({ success: true, data: sale });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

module.exports = {
    createSale,
    searchCustomer,
    getSales,
    getSaleById
};
