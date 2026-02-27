const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        enum: ['Cash', 'Bank'],
        required: true
    },
    balance: {
        type: Number,
        default: 0
    },
    accountNumber: {
        type: String,
        default: ''
    }
}, { timestamps: true });

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;
