const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
    {
        expenseName: {
            type: String,
            required: true,
            trim: true
        },
        expenseType: {
            type: String,
            enum: ['Daily', 'Monthly'],
            default: 'Daily'
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        notes: {
            type: String,
            default: '',
            trim: true
        },
        expenseDate: {
            type: Date,
            default: Date.now
        },
        expenseTime: {
            type: String,
            default: ''
        }
    },
    { timestamps: true }
);

expenseSchema.virtual('name')
    .get(function getName() {
        return this.expenseName;
    })
    .set(function setName(value) {
        this.expenseName = value;
    });

expenseSchema.virtual('date')
    .get(function getDate() {
        return this.expenseDate;
    })
    .set(function setDate(value) {
        this.expenseDate = value;
    });

expenseSchema.set('toJSON', { virtuals: true });
expenseSchema.set('toObject', { virtuals: true });

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;
