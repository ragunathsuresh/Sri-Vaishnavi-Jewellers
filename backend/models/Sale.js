
const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    saleType: {
        type: String,
        enum: ['B2B', 'B2C'],
        required: true
    },
    customerDetails: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        lastTransaction: { type: String, default: '' }
    },
    date: { type: String, required: true },
    time: { type: String, required: true },
    issuedItems: [{
        billNo: String,
        serialNo: String,
        itemName: String,
        jewelleryType: String,
        purity: String,
        grossWeight: { type: Number, default: 0 },
        stoneWeight: { type: Number, default: 0 },
        netWeight: { type: Number, default: 0 },
        weight: { type: Number, default: 0 }, // matches frontend
        currentCount: { type: Number, default: 0 },
        purchaseCount: { type: Number, default: 0 },
        sriCost: Number,
        sriBill: Number,
        plus: Number,
        paymentMode: { type: String, enum: ['Cash', 'Online'], default: 'Cash' },
        paidAmount: Number,
        date: { type: Date, default: Date.now },
        time: String
    }],
    receiptItems: [{
        billNo: { type: String },
        serialNo: { type: String },
        receiptType: { type: String },
        customReceiptType: { type: String, default: '' },
        weight: { type: Number },
        less: { type: Number },
        purity: { type: String },
        actualTouch: { type: Number },
        takenTouch: { type: Number },
        date: { type: Date, default: Date.now },
        time: { type: String }
    }],
    totalIssuedValue: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Completed', 'Pending'],
        default: 'Completed'
    }
}, { timestamps: true });

const Sale = mongoose.model('Sale', saleSchema);

module.exports = Sale;
