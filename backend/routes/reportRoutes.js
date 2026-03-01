const express = require('express');
const { protect, blockReadOnly } = require('../middlewares/authMiddleware');
const {
    downloadMonthlyPdf,
    createMonthlyPdfShareLink,
    serveSharedMonthlyPdf,
    downloadDailyPdf,
    createDailyPdfShareLink,
    downloadStockPdf,
    downloadTransactionHistoryPdf
} = require('../controllers/reportController');

const router = express.Router();

// Public tokenized link for WhatsApp recipients
router.get('/monthly/pdf/file/:token', serveSharedMonthlyPdf);

router.use(protect);
// router.use(blockReadOnly); // Removed to allow mobile/tablet read-only users to download reports
router.get('/monthly/pdf', downloadMonthlyPdf);
router.get('/monthly/pdf/share-link', createMonthlyPdfShareLink);
router.get('/daily/pdf', downloadDailyPdf);
router.get('/daily/pdf/share-link', createDailyPdfShareLink);
router.get('/stock/pdf', downloadStockPdf);
router.get('/transactions/pdf', downloadTransactionHistoryPdf);

module.exports = router;
