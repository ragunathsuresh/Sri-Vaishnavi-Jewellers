const mongoose = require('mongoose');

const calculationSettingSchema = new mongoose.Schema(
    {
        sriBillPercentage: {
            type: Number,
            default: 87,
            min: 0,
            max: 100
        },
        goldRate: {
            type: Number,
            required: true,
            min: 0
        },
        profitGoldRate: {
            type: Number,
            required: false,
            default: 0
        },
        effectiveDateStart: {
            type: Date,
            required: true
        },
        effectiveDateEnd: {
            type: Date,
            required: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('CalculationSetting', calculationSettingSchema);
