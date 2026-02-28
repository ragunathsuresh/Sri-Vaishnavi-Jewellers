const businessService = require('../services/businessService');

const calculate = async (req, res) => {
    try {
        const month = req.body.month || new Date().toISOString().slice(0, 7);
        const userId = req.user._id;

        // Update settings if provided
        if (req.body.sriBillPercentage !== undefined || req.body.goldRate !== undefined || req.body.profitGoldRate !== undefined) {
            await businessService.updateSettings(month, {
                sriBillPercentage: req.body.sriBillPercentage,
                goldRate: req.body.goldRate,
                profitGoldRate: req.body.profitGoldRate,
                effectiveDateStart: new Date(`${month}-01T00:00:00.000Z`),
                effectiveDateEnd: new Date(new Date(`${month}-01T00:00:00.000Z`).setUTCMonth(new Date(`${month}-01T00:00:00.000Z`).getUTCMonth() + 1))
            }, userId);
        }

        const data = await businessService.calculateBusinessStats(month, userId);
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getSummary = async (req, res) => {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const data = await businessService.getSummary(month);
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    calculate,
    getSummary
};
