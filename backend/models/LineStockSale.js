const mongoose = require('mongoose');

const lineStockSaleSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stock',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    lineStockId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LineStock',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const LineStockSale = mongoose.model('LineStockSale', lineStockSaleSchema);

module.exports = LineStockSale;
