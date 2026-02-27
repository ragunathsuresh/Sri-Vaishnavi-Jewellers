const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
    downloadMonthlyPdf,
    createMonthlyPdfShareLink,
    serveSharedMonthlyPdf,
    downloadDailyPdf,
    createDailyPdfShareLink
} = require('../controllers/reportController');

const router = express.Router();

// Public tokenized link for WhatsApp recipients
router.get('/monthly/pdf/file/:token', serveSharedMonthlyPdf);

router.use(protect);
router.get('/monthly/pdf', downloadMonthlyPdf);
router.get('/monthly/pdf/share-link', createMonthlyPdfShareLink);
router.get('/daily/pdf', downloadDailyPdf);
router.get('/daily/pdf/share-link', createDailyPdfShareLink);

module.exports = router;
