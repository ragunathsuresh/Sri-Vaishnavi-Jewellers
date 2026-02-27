const mongoose = require('mongoose');

const businessCalculationSchema = new mongoose.Schema(
    {
        adjustedStockGrams: { type: Number, required: true },
        purityGrams: { type: Number, required: true },
        cashConvertedGrams: { type: Number, required: true },
        receivedGoldGrams: { type: Number, required: true },
        otherAdditionGrams: { type: Number, required: true },
        debtReceivableGrams: { type: Number, required: true },
        debtPayableGrams: { type: Number, required: true },
        chitCollectionGrams: { type: Number, required: true },
        chitSavingsGrams: { type: Number, required: true },
        otherDeductionGrams: { type: Number, required: true },
        totalBusinessGrams: { type: Number, required: true },
        totalProfitFromSummary: { type: Number, required: true },
        expenseInGrams: { type: Number, required: true },
        netProfitBalance: { type: Number, required: true },
        calculationDate: { type: String, required: true }, // Format: YYYY-MM
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('BusinessCalculation', businessCalculationSchema);
