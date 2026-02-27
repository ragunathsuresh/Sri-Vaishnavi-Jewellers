const mongoose = require('mongoose');

const otherTransactionSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: [true, 'Date is required']
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        required: [true, 'Type is required'],
        enum: ['Addition', 'Subtraction']
    },
    grams: {
        type: Number,
        default: 0
    },
    amount: {
        type: Number,
        default: 0
    },
    month: {
        type: String,
        required: true,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('OtherTransaction', otherTransactionSchema);
