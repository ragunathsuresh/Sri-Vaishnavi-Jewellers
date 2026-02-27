const mongoose = require('mongoose');

const dealerTransactionSchema = new mongoose.Schema({
    dealerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dealer',
        required: true
    },
    transactionType: {
        type: String,
        enum: ['Stock In', 'Dealer Purchase', 'Opening Balance', 'Line Stock Issuance', 'Line Stock Settlement'],
        required: true
    },
    items: [{
        serialNo: String,
        itemName: String,
        jewelName: String,
        jewelleryType: String,
        category: String,
        purity: String,
        grossWeight: Number,
        netWeight: Number,
        quantity: Number
    }],
    totalGramPurchase: {
        type: Number,
        default: 0
    },
    sriBill: {
        type: Number,
        default: 0
    },
    userPurchaseGrams: {
        type: Number,
        default: 0
    },
    dealerPurchaseGrams: {
        type: Number,
        default: 0
    },
    totalValue: {
        type: Number,
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    date: {
        type: String,
        required: true
    },
    time: {
        type: String,
        required: true
    }
}, { timestamps: true });

const DealerTransaction = mongoose.model('DealerTransaction', dealerTransactionSchema);

module.exports = DealerTransaction;
