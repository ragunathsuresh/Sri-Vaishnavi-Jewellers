
const mongoose = require('mongoose');

const goldRateSchema = new mongoose.Schema(
    {
        date: {
            type: Date,
            default: () => {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                return now;
            },
            index: true
        },
        rate: {
            type: Number,
            required: true,
            min: [0.01, 'Gold rate must be a positive number']
        },
        unit: {
            type: String,
            default: 'gm'
        },
        karat: {
            type: String,
            default: '22K'
        }
    },
    { timestamps: true }
);

const GoldRate = mongoose.model('GoldRate', goldRateSchema);

module.exports = GoldRate;
