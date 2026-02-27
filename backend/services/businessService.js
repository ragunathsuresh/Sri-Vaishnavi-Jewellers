const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const ChitFund = require('../models/ChitFund');
const OtherTransaction = require('../models/OtherTransaction');
const CalculationSetting = require('../models/CalculationSetting');
const BusinessCalculation = require('../models/BusinessCalculation');
const billingService = require('./billingService');

const round3 = (val) => Math.round((val + Number.EPSILON) * 1000) / 1000;

const getLatestSettings = async (monthString) => {
    return await CalculationSetting.findOne({
        effectiveDateStart: { $lte: new Date(`${monthString}-28`) },
        effectiveDateEnd: { $gte: new Date(`${monthString}-01`) }
    }).sort({ createdAt: -1 });
};

const updateSettings = async (monthString, settings, userId) => {
    const { sriBillPercentage, goldRate, effectiveDateStart, effectiveDateEnd } = settings;
    return await CalculationSetting.findOneAndUpdate(
        { effectiveDateStart, effectiveDateEnd },
        { sriBillPercentage, goldRate, createdBy: userId },
        { upsert: true, new: true }
    );
};

const calculateBusinessStats = async (monthString, userId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // 1. Get Settings
        const settings = await getLatestSettings(monthString);
        const sriBillPercentage = settings?.sriBillPercentage || 87;
        const goldRate = settings?.goldRate || 0;

        // 2. Get Billing Summary Data (leveraging existing service)
        const billingSummary = await billingService.getMonthlySummary(monthString);

        // A. Adjusted Stock
        const totalStockWeight = billingSummary.cards.totalStockWeight || 0;
        const adjustedStockGrams = round3(totalStockWeight * (sriBillPercentage / 100));

        // B. Cash Converted
        const cashBalance = billingSummary.cards.cashBalance || 0;
        const cashConvertedGrams = goldRate > 0 ? round3(cashBalance / goldRate) : 0;

        // C. Debt Receivable & Payable
        const debtReceivableGrams = round3(billingSummary.debtReceivableTotal || 0);
        const debtPayableGrams = round3(billingSummary.debtPayableTotal || 0);

        // D. Chit Collection
        const chitCollectionGrams = round3(billingSummary.chitFundsGrams || 0);

        // E. Other Transactions (Additions & Subtractions)
        let otherAdditionGrams = 0;
        let otherDeductionGrams = 0;
        billingSummary.otherTransactions.forEach(t => {
            if (t.type === 'Addition') otherAdditionGrams += (t.grams || 0);
            else otherDeductionGrams += (t.grams || 0);
        });
        otherAdditionGrams = round3(otherAdditionGrams);
        otherDeductionGrams = round3(otherDeductionGrams);

        // F. TOTAL BUSINESS HOLDING
        const totalBusinessGrams = round3(
            adjustedStockGrams +
            cashConvertedGrams +
            debtReceivableGrams +
            otherAdditionGrams -
            debtPayableGrams -
            chitCollectionGrams -
            otherDeductionGrams
        );

        // G. PROFIT CALCULATION
        const totalProfitFromSummary = round3(billingSummary.plusSummaryTotals.totalProfit || 0);
        const totalExpenseAmount = billingSummary.expensesTotal || 0;
        const expenseInGrams = goldRate > 0 ? round3(totalExpenseAmount / goldRate) : 0;
        const netProfitBalance = round3(totalProfitFromSummary - expenseInGrams);

        // Update or Create Calculation Result
        const calculation = await BusinessCalculation.findOneAndUpdate(
            { calculationDate: monthString },
            {
                adjustedStockGrams,
                purityGrams: 0, // Placeholder if needed later
                cashConvertedGrams,
                receivedGoldGrams: 0, // Placeholder
                otherAdditionGrams,
                debtReceivableGrams,
                debtPayableGrams,
                chitCollectionGrams,
                chitSavingsGrams: 0,
                otherDeductionGrams,
                totalBusinessGrams,
                totalProfitFromSummary,
                expenseInGrams,
                netProfitBalance,
                createdBy: userId
            },
            { upsert: true, new: true, session }
        );

        await session.commitTransaction();
        return {
            summary: calculation,
            settings: { sriBillPercentage, goldRate }
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getSummary = async (monthString) => {
    const calculation = await BusinessCalculation.findOne({ calculationDate: monthString });
    const settings = await getLatestSettings(monthString);
    return {
        summary: calculation,
        settings: settings ? { sriBillPercentage: settings.sriBillPercentage, goldRate: settings.goldRate } : null
    };
};

module.exports = {
    calculateBusinessStats,
    getSummary,
    updateSettings
};
