const mongoose = require('mongoose');

const dealerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true
    },
    runningBalance: {
        type: Number,
        default: 0
    },
    balanceType: {
        type: String,
        enum: ['Dealer Owes Us', 'We Owe Dealer'],
        required: true
    },
    dealerType: {
        type: String,
        enum: ['Dealer', 'Line Stocker'],
        default: 'Dealer'
    }
}, { timestamps: true });

// Virtual to determine the sign based on balanceType logic from prompt
// Positive: We owe dealer
// Negative: Dealer owes us
dealerSchema.pre('save', function () {
    if (this.balanceType === 'Dealer Owes Us' && this.runningBalance < 0) {
        this.runningBalance = Math.abs(this.runningBalance);
    } else if (this.balanceType === 'We Owe Dealer' && this.runningBalance > 0) {
        this.runningBalance = -Math.abs(this.runningBalance);
    }
});

const Dealer = mongoose.model('Dealer', dealerSchema);

module.exports = Dealer;
