
const Stock = require('../models/Stock');

// @desc    Get all stock items
// @route   GET /api/stock
// @access  Private
const getStocks = async (req, res) => {
    try {
        const stocks = await Stock.find().sort({ createdAt: -1 });

        // Calculate footer stats — active items only (currentCount > 0)
        const activeStocks = stocks.filter(s => (s.currentCount || 0) > 0);
        const totalJewels = activeStocks.length;
        const totalCount = activeStocks.reduce((acc, curr) => acc + (curr.currentCount || 0), 0);
        const totalWeight = activeStocks.reduce((acc, curr) => acc + ((curr.netWeight || 0) * (curr.currentCount || 1)), 0);

        res.status(200).json({
            success: true,
            data: stocks,
            stats: {
                totalJewels: `${totalJewels} Items`,
                totalCount,
                totalWeight: totalWeight.toFixed(3)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add new stock item
// @route   POST /api/stock
// @access  Private
const addStock = async (req, res) => {
    try {
        const { serialNo, currentCount, purchaseCount } = req.body;

        // Check if stock with this serial already exists
        let stock = await Stock.findOne({ serialNo });

        if (stock) {
            // Restocking: Increment existing counts
            // currentCount from body represents "New Quantity" being added
            const addedQty = parseInt(currentCount) || 0;
            stock.currentCount += addedQty;
            stock.purchaseCount += addedQty;

            // Optionally update other details if provided (itemName, weight, etc.)
            Object.keys(req.body).forEach(key => {
                if (key !== 'currentCount' && key !== 'purchaseCount' && key !== 'serialNo' && req.body[key]) {
                    stock[key] = req.body[key];
                }
            });

            await stock.save();
            return res.status(200).json({
                success: true,
                message: 'Existing stock updated successfully',
                data: stock
            });
        }

        // New Item: Create fresh record
        stock = await Stock.create({
            ...req.body,
            date: req.body.date || Date.now()
        });

        res.status(201).json({
            success: true,
            message: 'New stock added successfully',
            data: stock
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single stock item
// @route   GET /api/stock/:id
// @access  Private
const getStockById = async (req, res) => {
    try {
        const stock = await Stock.findById(req.params.id);
        if (!stock) {
            return res.status(404).json({ success: false, message: 'Stock item not found' });
        }
        res.status(200).json({ success: true, data: stock });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update stock item
// @route   PUT /api/stock/:id
// @access  Private
const updateStock = async (req, res) => {
    try {
        const { currentCount, purchaseCount, ...otherData } = req.body;

        // Use $set for descriptive fields and $inc for counts to make it additive
        const stock = await Stock.findByIdAndUpdate(req.params.id, {
            $set: otherData,
            $inc: {
                currentCount: parseInt(currentCount) || 0,
                purchaseCount: parseInt(purchaseCount) || 0
            }
        }, {
            new: true,
            runValidators: true
        });

        if (!stock) {
            return res.status(404).json({ success: false, message: 'Stock item not found' });
        }
        res.status(200).json({ success: true, data: stock });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get stock by serial number
// @route   GET /api/stock/serial/:serialNo
// @access  Private
const getStockBySerialNo = async (req, res) => {
    try {
        const stock = await Stock.findOne({
            serialNo: { $regex: new RegExp(`^${req.params.serialNo}$`, 'i') }
        });
        if (!stock) {
            return res.status(404).json({ success: false, message: 'Stock item not found' });
        }
        res.status(200).json({ success: true, data: stock });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Search stock items for suggestions
// @route   GET /api/stock/search?query=...
// @access  Private
const searchStock = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(200).json({ success: true, data: [] });

        const searchRegex = new RegExp(query, 'i');
        const stocks = await Stock.find({
            $or: [
                { serialNo: searchRegex },
                { itemName: searchRegex }
            ],
            currentCount: { $gt: 0 }
        }).limit(10);

        res.status(200).json({ success: true, data: stocks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get stock history by serial number (any item, sold or not)
// @route   GET /api/stock/history/:serialNo
// @access  Private
const getStockHistoryBySerialNo = async (req, res) => {
    try {
        const stock = await Stock.findOne({
            serialNo: { $regex: new RegExp(`^${req.params.serialNo}$`, 'i') }
        }).sort({ createdAt: -1 });

        if (!stock) {
            return res.status(404).json({ success: false, message: 'Item not found in history' });
        }
        res.status(200).json({ success: true, data: stock });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete stock item
// @route   DELETE /api/stock/:id
// @access  Private
const deleteStock = async (req, res) => {
    try {
        const stock = await Stock.findByIdAndDelete(req.params.id);
        if (!stock) {
            return res.status(404).json({ success: false, message: 'Stock item not found' });
        }
        res.status(200).json({ success: true, message: 'Stock item deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getStocks,
    addStock,
    getStockById,
    updateStock,
    getStockBySerialNo,
    searchStock,
    getStockHistoryBySerialNo,
    deleteStock
};
