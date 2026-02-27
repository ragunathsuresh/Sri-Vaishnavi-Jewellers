const mongoose = require('mongoose');
const Counter = require('./Counter');

const chitFundSchema = new mongoose.Schema(
    {
        serialNumber: {
            type: Number,
            unique: true,
            index: true
        },
        customerName: {
            type: String,
            required: [true, 'Customer name is required'],
            trim: true
        },
        phoneNumber: {
            type: String,
            required: [true, 'Phone number is required'],
            match: [/^\d{10}$/, 'Phone number must be exactly 10 digits']
        },
        date: {
            type: Date,
            required: [true, 'Date is required']
        },
        time: {
            type: String,
            trim: true
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0.01, 'Amount must be a positive number']
        },
        isPastEntry: { type: Boolean, default: false },
        goldRateToday: {
            type: Number,
            required: [true, 'Gold rate today is required'],
            min: [0.01, 'Gold rate today must be a positive number']
        },
        rateApplied: {
            type: Number,
            min: [0.01, 'Rate applied must be a positive number']
        },
        gramsPurchased: {
            type: Number,
            required: true,
            min: [0, 'Grams purchased cannot be negative']
        }
    },
    { timestamps: true }
);

chitFundSchema.pre('validate', async function assignCalculatedFields() {
    if (!this.rateApplied && this.goldRateToday > 0) {
        this.rateApplied = this.goldRateToday;
    }

    if (!this.isPastEntry && this.amount > 0 && this.rateApplied > 0) {
        this.gramsPurchased = Number((this.amount / this.rateApplied).toFixed(6));
    }

    if (!this.time) {
        this.time = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
});

chitFundSchema.pre('save', async function assignSerialNumber() {
    if (this.isNew && !this.serialNumber) {
        const counter = await Counter.findOneAndUpdate(
            { key: 'chitFundSerial' },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        this.serialNumber = counter.seq;
    }
});

module.exports = mongoose.model('ChitFund', chitFundSchema);
