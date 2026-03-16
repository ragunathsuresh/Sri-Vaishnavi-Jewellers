const mongoose = require('mongoose');

const lineStockSettlementSchema = new mongoose.Schema({
    lineStockId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LineStock',
        required: true
    },
    personName: { type: String, required: true },
    phoneNumber: { type: String },
    date: { type: Date, default: Date.now },
    previousBalance: { type: Number, default: 0 },
    issuedBalance: { type: Number, default: 0 }, // Sum of sold grams from issuedTransactions
    receiptBalance: { type: Number, default: 0 }, // Sum of settled grams from receiptTransactions
    finalBalance: { type: Number, default: 0 },
    issuedTransactions: [{
        billNo: String,
        serialNo: String,
        itemName: String,
        weight: Number,
        quantity: Number,
        sriCost: Number,
        sriBill: Number,
        sriPlus: Number,
        purityValue: Number,
        saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' }
    }],
    receiptTransactions: [{
        billNo: String,
        type: {
            type: String,
            enum: ['Pure Gold', 'Other Jewellery', 'Cash']
        },
        weight: Number,
        actualTouch: Number,
        takenTouch: Number,
        less: Number,
        purity: Number,
        cashAmount: Number,
        goldRate: Number
    }]
}, { timestamps: true });

module.exports = mongoose.model('LineStockSettlement', lineStockSettlementSchema);
