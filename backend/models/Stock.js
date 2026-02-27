const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
    serialNo: {
        type: String,
        required: true,
        unique: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    time: {
        type: String,
        required: true
    },
    itemName: {
        type: String,
        required: true
    },
    jewelName: {
        type: String,
        default: ''
    },
    jewelleryType: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    designName: {
        type: String,
        default: ''
    },
    hsnCode: {
        type: String,
        default: ''
    },
    supplierName: {
        type: String,
        default: ''
    },
    purchaseInvoiceNo: {
        type: String,
        default: ''
    },
    grossWeight: {
        type: Number,
        required: true
    },
    stoneWeight: {
        type: Number,
        default: 0
    },
    netWeight: {
        type: Number,
        required: true
    },
    purity: {
        type: String,
        required: true
    },
    currentCount: {
        type: Number,
        required: true,
        default: 1
    },
    purchaseCount: {
        type: Number,
        required: true,
        default: 1
    },
    wastage: {
        type: Number,
        default: 0
    },
    image: {
        type: String,
        default: ''
    },
    saleType: {
        type: String,
        enum: ['General', 'B2B', 'B2C'],
        default: 'General'
    },
    costPrice: {
        type: Number,
        default: 0
    },
    sellingPrice: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Stock = mongoose.model('Stock', stockSchema);

module.exports = Stock;
