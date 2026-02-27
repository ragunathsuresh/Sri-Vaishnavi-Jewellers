const mongoose = require('mongoose');

const lineStockItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stock',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    issuedQty: {
        type: Number,
        required: true
    },
    soldQty: {
        type: Number,
        default: 0
    },
    returnedQty: {
        type: Number,
        default: 0
    },
    totalIssuedValue: {
        type: Number,
        default: 0
    },
    totalSoldValue: {
        type: Number,
        default: 0
    },
    totalReturnedValue: {
        type: Number,
        default: 0
    }
});

const lineStockSchema = new mongoose.Schema({
    lineNumber: {
        type: String,
        required: true,
        unique: true
    },
    personName: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    issuedDate: {
        type: Date,
        default: Date.now
    },
    expectedReturnDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['ISSUED', 'OVERDUE', 'SETTLED', 'CLOSED'],
        default: 'ISSUED'
    },
    items: [lineStockItemSchema],
    totals: {
        issued: { type: Number, default: 0 },
        sold: { type: Number, default: 0 },
        returned: { type: Number, default: 0 },
        manualValue: { type: Number, default: 0 }
    }
}, { timestamps: true });

// Middleware to check if overdue before saving/finding? 
// The prompt says GET /api/line-stock must automatically mark records as OVERDUE.
// We can handle that in the controller or a pre-find middleware.

const LineStock = mongoose.model('LineStock', lineStockSchema);

module.exports = LineStock;
