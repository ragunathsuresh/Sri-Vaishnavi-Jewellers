const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const billingService = require('../services/billingService');
const Expense = require('../models/Expense');

const SHARED_DIR = path.join(__dirname, '..', 'temp', 'shared-reports');
const SHARED_TTL_MS = 30 * 60 * 1000;
const WATERMARK_PATH = (() => {
    const candidates = ['ganesh.png', 'ganesh.jpg'];
    for (const name of candidates) {
        const p = path.join(__dirname, '..', 'assets', name);
        if (fs.existsSync(p)) return p;
    }
    return path.join(__dirname, '..', 'assets', 'ganesh.png'); // fallback (will be skipped if missing)
})();

const ensureSharedDir = () => {
    fs.mkdirSync(SHARED_DIR, { recursive: true });
};

const cleanupOldSharedFiles = () => {
    ensureSharedDir();
    const now = Date.now();
    for (const file of fs.readdirSync(SHARED_DIR)) {
        const filePath = path.join(SHARED_DIR, file);
        try {
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs > SHARED_TTL_MS) {
                fs.unlinkSync(filePath);
            }
        } catch {
            // ignore stale cleanup errors
        }
    }
};

const num3 = (value) => Number(value || 0).toFixed(3);
const fmtDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
};

// Draw Ganesh watermark centered on the current page (very low opacity)
const drawWatermarkOnPage = (doc) => {
    try {
        // DEFENSIVE: check if doc is already ended or closed
        if (!doc || doc._ended || doc.finished) return;
        if (!fs.existsSync(WATERMARK_PATH)) return;

        const pw = doc.page.width;
        const ph = doc.page.height;
        const size = Math.min(pw, ph) * 0.6;
        const x = (pw - size) / 2;
        const y = (ph - size) / 2;

        doc.save();
        doc.opacity(0.07);
        doc.image(WATERMARK_PATH, x, y, { width: size, height: size });
        doc.restore();
    } catch (err) {
        // Non-critical: silently skip
    }
};

// Attach watermark to every page of a PDFDocument
const attachWatermark = (doc) => {
    // 1. Draw on the current (first) page immediately
    drawWatermarkOnPage(doc);

    // 2. Hook into pageAdded for subsequent pages
    doc.on('pageAdded', () => {
        // Double check doc state inside event listener
        if (!doc._ended && !doc.finished) {
            drawWatermarkOnPage(doc);
        }
    });
};

const parseDateInput = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    const base = new Date(`${dateString}T00:00:00.000Z`);
    if (Number.isNaN(base.getTime())) {
        throw new Error('Invalid date value');
    }
    const start = new Date(base);
    const end = new Date(base);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
};

const drawGridSummary = (doc, startX, startY, width, cards) => {
    const gap = 12;
    const colWidth = (width - gap) / 2;
    const rowHeight = 58;
    const cells = [
        ['Total Stock Items', String(cards.totalStockItems || 0)],
        ['Total Stock Weight (grams)', num3(cards.totalStockWeight)],
        ['Monthly Sales (bill count)', String(cards.monthlySalesBills || 0)],
        ['Amount Currently Available', num3(cards.cashBalance)]
    ];
    for (let i = 0; i < cells.length; i += 1) {
        const r = Math.floor(i / 2);
        const c = i % 2;
        const x = startX + (c * (colWidth + gap));
        const y = startY + (r * (rowHeight + gap));
        doc.roundedRect(x, y, colWidth, rowHeight, 4).lineWidth(0.6).stroke('#BFC5CE');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#455468').text(cells[i][0], x + 8, y + 8, { width: colWidth - 16 });
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#111827').text(cells[i][1], x + 8, y + 27, { width: colWidth - 16 });
    }
    return startY + (rowHeight * 2) + gap;
};

const createTableRenderer = (doc, margins) => {
    const pageBottom = () => doc.page.height - margins.bottom;
    const pageWidth = () => doc.page.width - margins.left - margins.right;
    let y = margins.top;

    const ensureSpace = (requiredHeight) => {
        if (y + requiredHeight <= pageBottom()) return;
        doc.addPage();
        y = margins.top;
    };

    const drawSectionTitle = (title) => {
        ensureSpace(26);
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(title, margins.left, y);
        y += 20;
    };

    const drawTable = ({ headers, rows, widths, aligns = [], totalsRow = null }) => {
        const totalW = widths.reduce((a, b) => a + b, 0);
        const scale = totalW > pageWidth() ? pageWidth() / totalW : 1;
        const scaled = widths.map((w) => w * scale);
        const headerH = 22;
        const rowH = 18;

        const drawHeader = () => {
            ensureSpace(headerH + rowH);
            let x = margins.left;
            doc.rect(margins.left, y, scaled.reduce((a, b) => a + b, 0), headerH).fillAndStroke('#EEF2F7', '#CBD5E1');
            for (let i = 0; i < headers.length; i += 1) {
                doc.rect(x, y, scaled[i], headerH).stroke('#CBD5E1');
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151').text(String(headers[i]), x + 4, y + 7, {
                    width: scaled[i] - 8,
                    align: aligns[i] || 'left'
                });
                x += scaled[i];
            }
            y += headerH;
        };

        drawHeader();
        for (const row of rows) {
            ensureSpace(rowH);
            if (y + rowH > pageBottom()) {
                doc.addPage();
                y = margins.top;
                drawHeader();
            }
            let x = margins.left;
            for (let i = 0; i < headers.length; i += 1) {
                const value = row[i] !== undefined && row[i] !== null ? String(row[i]) : '';
                doc.rect(x, y, scaled[i], rowH).stroke('#E5E7EB');
                doc.font('Helvetica').fontSize(8).fillColor('#111827').text(value, x + 4, y + 5, {
                    width: scaled[i] - 8,
                    align: aligns[i] || 'left'
                });
                x += scaled[i];
            }
            y += rowH;
        }

        if (totalsRow) {
            ensureSpace(rowH);
            let x = margins.left;
            for (let i = 0; i < headers.length; i += 1) {
                doc.rect(x, y, scaled[i], rowH).fillAndStroke('#F9FAFB', '#D1D5DB');
                const value = totalsRow[i] !== undefined && totalsRow[i] !== null ? String(totalsRow[i]) : '';
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#111827').text(value, x + 4, y + 5, {
                    width: scaled[i] - 8,
                    align: aligns[i] || 'left'
                });
                x += scaled[i];
            }
            y += rowH;
        }
        y += 14;
    };

    const setY = (newY) => {
        y = newY;
    };

    const getY = () => y;

    return { drawSectionTitle, drawTable, ensureSpace, setY, getY, pageWidth, pageBottom };
};

const writeMonthlyPdf = (doc, summary, month) => {
    attachWatermark(doc);
    const margins = { top: 50, left: 50, right: 50, bottom: 50 };
    const renderer = createTableRenderer(doc, margins);
    const generatedAt = new Date();

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Sri Vaishnavi Jewellers', margins.left, margins.top, {
        width: renderer.pageWidth(),
        align: 'center'
    });
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text('Monthly Billing Summary', margins.left, margins.top + 22, {
        width: renderer.pageWidth(),
        align: 'center'
    });
    doc.font('Helvetica').fontSize(10).fillColor('#4B5563').text(`Month: ${month}`, margins.left, margins.top + 50, {
        width: renderer.pageWidth(),
        align: 'center'
    });
    doc.font('Helvetica').fontSize(10).fillColor('#4B5563').text(`Generated: ${generatedAt.toLocaleString('en-IN')}`, margins.left, margins.top + 66, {
        width: renderer.pageWidth(),
        align: 'center'
    });

    const summaryBottom = drawGridSummary(doc, margins.left, margins.top + 96, renderer.pageWidth(), summary.cards || {});
    renderer.setY(summaryBottom + 12);

    renderer.drawSectionTitle('1. Customer Sales Table');
    const salesRows = (summary.customerSales || []).map((r) => [
        r.customerName || '-',
        r.phoneNumber || '-',
        fmtDate(r.date),
        r.time || '-',
        r.billNumber || '-',
        r.itemName || '-',
        num3(r.weight),
        num3(r.sriCost),
        num3(r.sriBill),
        num3(r.plus)
    ]);
    renderer.drawTable({
        headers: ['Customer Name', 'Phone Number', 'Date', 'Time', 'Bill Number', 'Item Name', 'Weight (g)', 'Sri Cost (%)', 'Sri Bill (%)', 'Sri Plus (+)'],
        rows: salesRows,
        widths: [80, 72, 58, 44, 52, 78, 46, 48, 48, 48],
        aligns: ['left', 'left', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right']
    });

    renderer.drawSectionTitle('2. Customer Plus Summary Table');
    renderer.drawTable({
        headers: ['Plus', 'Total Weight (g)', 'Profit'],
        rows: (summary.plusSummary || []).map((r) => [num3(r.plus), num3(r.totalWeight), num3(r.profit)]),
        widths: [110, 140, 120],
        aligns: ['right', 'right', 'right'],
        totalsRow: ['TOTAL', num3(summary.plusSummaryTotals?.totalWeight), num3(summary.plusSummaryTotals?.totalProfit)]
    });

    renderer.drawSectionTitle('3. Debt Payable');
    renderer.drawTable({
        headers: ['Name', 'Phone Number', 'Amount'],
        rows: (summary.debtPayable || []).map((r) => [r.name || '-', r.phoneNumber || '-', num3(r.amount)]),
        widths: [160, 140, 120],
        aligns: ['left', 'left', 'right'],
        totalsRow: ['TOTAL', '', num3(summary.debtPayableTotal || 0)]
    });

    renderer.drawSectionTitle('4. Debt Receivable');
    renderer.drawTable({
        headers: ['Name', 'Phone Number', 'Amount'],
        rows: (summary.debtReceivable || []).map((r) => [r.name || '-', r.phoneNumber || '-', num3(r.amount)]),
        widths: [160, 140, 120],
        aligns: ['left', 'left', 'right'],
        totalsRow: ['TOTAL', '', num3(summary.debtReceivableTotal || 0)]
    });

    renderer.drawSectionTitle('5. Expenses (Daily + Monthly)');
    renderer.drawTable({
        headers: ['Date', 'Expense Name', 'Type', 'Amount', 'Notes'],
        rows: (summary.expenses || []).map((r) => [fmtDate(r.expenseDate), r.expenseName || '-', r.expenseType || '-', num3(r.amount), r.notes || '-']),
        widths: [90, 130, 70, 70, 150],
        aligns: ['left', 'left', 'left', 'right', 'left'],
        totalsRow: ['TOTAL', '', '', num3(summary.expensesTotal || 0), '']
    });

    renderer.drawSectionTitle('6. Chit Funds');
    renderer.drawTable({
        headers: ['Date', 'Amount'],
        rows: (summary.chitFunds || []).map((r) => [fmtDate(r.date), num3(r.amount)]),
        widths: [140, 140],
        aligns: ['left', 'right'],
        totalsRow: ['TOTAL', num3(summary.chitFundsTotal || 0)]
    });

    if (summary.otherTransactions && summary.otherTransactions.length > 0) {
        renderer.drawSectionTitle('7. Others');
        const otherRows = summary.otherTransactions.map(r => [
            fmtDate(r.date),
            r.name || '-',
            r.description || '-',
            r.type || '-',
            num3(r.grams),
            num3(r.amount)
        ]);

        const otherTotals = summary.otherTransactions.reduce((acc, r) => {
            const g = Number(r.grams || 0);
            const a = Number(r.amount || 0);
            if (r.type === 'Addition') {
                acc.grams += g;
                acc.amount += a;
            } else {
                acc.grams -= g;
                acc.amount -= a;
            }
            return acc;
        }, { grams: 0, amount: 0 });

        renderer.drawTable({
            headers: ['Date', 'Name', 'Description', 'Type', 'Grams', 'Amount'],
            rows: otherRows,
            widths: [60, 80, 140, 60, 60, 80],
            aligns: ['left', 'left', 'left', 'left', 'right', 'right'],
            totalsRow: ['NET TOTAL', '', '', '', num3(otherTotals.grams), num3(otherTotals.amount)]
        });
    }
};

const writeDailyPdf = (doc, summary, dateString, expenses, expensesTotal) => {
    attachWatermark(doc);
    const margins = { top: 50, left: 50, right: 50, bottom: 50 };
    const renderer = createTableRenderer(doc, margins);
    const generatedAt = new Date();

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Sri Vaishnavi Jewellers', margins.left, margins.top, {
        width: renderer.pageWidth(),
        align: 'center'
    });
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text('Daily Billing Summary', margins.left, margins.top + 22, {
        width: renderer.pageWidth(),
        align: 'center'
    });
    doc.font('Helvetica').fontSize(10).fillColor('#4B5563').text(`Date: ${dateString}`, margins.left, margins.top + 50, {
        width: renderer.pageWidth(),
        align: 'center'
    });
    doc.font('Helvetica').fontSize(10).fillColor('#4B5563').text(`Generated: ${generatedAt.toLocaleString('en-IN')}`, margins.left, margins.top + 66, {
        width: renderer.pageWidth(),
        align: 'center'
    });

    const dailyCards = {
        totalStockItems: summary.cards?.totalStockItems || 0,
        totalStockWeight: summary.cards?.totalStockWeight || 0,
        monthlySalesBills: summary.cards?.dailySalesBills || 0,
        cashBalance: summary.cards?.cashBalance || 0
    };
    const summaryBottom = drawGridSummary(doc, margins.left, margins.top + 96, renderer.pageWidth(), dailyCards);
    renderer.setY(summaryBottom + 12);

    renderer.drawSectionTitle('1. Customer Sales Table');
    renderer.drawTable({
        headers: ['Customer Name', 'Phone Number', 'Date', 'Time', 'Bill Number', 'Item Name', 'Weight (g)', 'Sri Cost (%)', 'Sri Bill (%)', 'Sri Plus (+)'],
        rows: (summary.customerSales || []).map((r) => [
            r.customerName || '-',
            r.phoneNumber || '-',
            fmtDate(r.date),
            r.time || '-',
            r.billNumber || '-',
            r.itemName || '-',
            num3(r.weight),
            num3(r.sriCost),
            num3(r.sriBill),
            num3(r.plus)
        ]),
        widths: [80, 72, 58, 44, 52, 78, 46, 48, 48, 48],
        aligns: ['left', 'left', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right']
    });

    renderer.drawSectionTitle('2. Customer Plus Summary Table');
    renderer.drawTable({
        headers: ['Plus', 'Total Weight (g)', 'Profit'],
        rows: (summary.plusSummary || []).map((r) => [num3(r.plus), num3(r.totalWeight), num3(r.profit)]),
        widths: [110, 140, 120],
        aligns: ['right', 'right', 'right'],
        totalsRow: ['TOTAL', num3(summary.plusSummaryTotals?.totalWeight), num3(summary.plusSummaryTotals?.totalProfit)]
    });

    const debtPayableTotal = (summary.debtPayable || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const debtReceivableTotal = (summary.debtReceivable || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);

    renderer.drawSectionTitle('3. Debt Payable');
    renderer.drawTable({
        headers: ['Name', 'Phone Number', 'Amount'],
        rows: (summary.debtPayable || []).map((r) => [r.name || '-', r.phoneNumber || '-', num3(r.amount)]),
        widths: [160, 140, 120],
        aligns: ['left', 'left', 'right'],
        totalsRow: ['TOTAL', '', num3(debtPayableTotal)]
    });

    renderer.drawSectionTitle('4. Debt Receivable');
    renderer.drawTable({
        headers: ['Name', 'Phone Number', 'Amount'],
        rows: (summary.debtReceivable || []).map((r) => [r.name || '-', r.phoneNumber || '-', num3(r.amount)]),
        widths: [160, 140, 120],
        aligns: ['left', 'left', 'right'],
        totalsRow: ['TOTAL', '', num3(debtReceivableTotal)]
    });

    renderer.drawSectionTitle('5. Daily Expenses');
    renderer.drawTable({
        headers: ['Expense Name', 'Type', 'Time', 'Amount', 'Notes'],
        rows: (expenses || []).map((r) => [
            r.expenseName || '-',
            r.expenseType || '-',
            r.expenseTime || '-',
            num3(r.amount),
            r.notes || '-'
        ]),
        widths: [160, 80, 80, 80, 190],
        aligns: ['left', 'left', 'left', 'right', 'left'],
        totalsRow: ['TOTAL', '', '', num3(expensesTotal || 0), '']
    });
};

const buildPhone = (value) => String(value || '').replace(/\D/g, '');

const downloadMonthlyPdf = async (req, res) => {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const summary = await billingService.getMonthlyBillingSummary(month);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="monthly-billing-summary-${month}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 50 });
        doc.pipe(res);
        writeMonthlyPdf(doc, summary, month);
        doc.end();
    } catch (error) {
        const status = /Invalid month/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message || 'Failed to generate PDF' });
    }
};

const createMonthlyPdfShareLink = async (req, res) => {
    try {
        cleanupOldSharedFiles();
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const phone = buildPhone(req.query.phone);
        const summary = await billingService.getMonthlyBillingSummary(month);

        ensureSharedDir();
        const token = crypto.randomUUID();
        const filePath = path.join(SHARED_DIR, `${token}.pdf`);

        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 50 });
            out.on('finish', resolve);
            out.on('error', reject);
            doc.pipe(out);
            writeMonthlyPdf(doc, summary, month);
            doc.end();
        });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const fileUrl = `${baseUrl}/api/reports/monthly/pdf/file/${token}`;
        const text = `Monthly Billing Summary (${month}) PDF:\n${fileUrl}`;
        const waBase = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
        const whatsappUrl = `${waBase}?text=${encodeURIComponent(text)}`;

        res.status(200).json({
            success: true,
            data: {
                fileUrl,
                whatsappUrl,
                expiresInMinutes: 30
            }
        });
    } catch (error) {
        const status = /Invalid month/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message || 'Failed to create share link' });
    }
};

const getDailyExpenses = async (dateString) => {
    const { start, end } = parseDateInput(dateString);
    const expenseRows = await Expense.find({
        expenseDate: { $gte: start, $lt: end },
        expenseType: 'Daily'
    }).sort({ expenseDate: 1, createdAt: 1 });
    const expenses = expenseRows.map((row) => ({
        expenseName: row.expenseName,
        expenseType: row.expenseType,
        expenseTime: row.expenseTime || '',
        amount: Number(row.amount || 0),
        notes: row.notes || ''
    }));
    const total = expenses.reduce((acc, row) => acc + Number(row.amount || 0), 0);
    return { expenses, total };
};

const downloadDailyPdf = async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().slice(0, 10);
        const summary = await billingService.getBillingSummary(date);
        const { expenses, total } = await getDailyExpenses(date);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="daily-billing-summary-${date}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 50 });
        doc.pipe(res);
        writeDailyPdf(doc, summary, date, expenses, total);
        doc.end();
    } catch (error) {
        const status = /Invalid date/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message || 'Failed to generate PDF' });
    }
};

const createDailyPdfShareLink = async (req, res) => {
    try {
        cleanupOldSharedFiles();
        const date = req.query.date || new Date().toISOString().slice(0, 10);
        const phone = buildPhone(req.query.phone);
        const summary = await billingService.getBillingSummary(date);
        const { expenses, total } = await getDailyExpenses(date);

        ensureSharedDir();
        const token = crypto.randomUUID();
        const filePath = path.join(SHARED_DIR, `${token}.pdf`);

        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 50 });
            out.on('finish', resolve);
            out.on('error', reject);
            doc.pipe(out);
            writeDailyPdf(doc, summary, date, expenses, total);
            doc.end();
        });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const fileUrl = `${baseUrl}/api/reports/monthly/pdf/file/${token}`;
        const text = `Daily Billing Summary (${date}) PDF:\n${fileUrl}`;
        const waBase = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
        const whatsappUrl = `${waBase}?text=${encodeURIComponent(text)}`;

        res.status(200).json({
            success: true,
            data: {
                fileUrl,
                whatsappUrl,
                expiresInMinutes: 30
            }
        });
    } catch (error) {
        const status = /Invalid date/.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message || 'Failed to create share link' });
    }
};

const serveSharedMonthlyPdf = async (req, res) => {
    try {
        const token = String(req.params.token || '').trim();
        if (!token) return res.status(400).send('Invalid token');
        const filePath = path.join(SHARED_DIR, `${token}.pdf`);
        if (!fs.existsSync(filePath)) return res.status(404).send('File not found or expired');

        const stat = fs.statSync(filePath);
        if (Date.now() - stat.mtimeMs > SHARED_TTL_MS) {
            try { fs.unlinkSync(filePath); } catch { /* ignore */ }
            return res.status(410).send('File expired');
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="monthly-billing-summary.pdf"`);
        fs.createReadStream(filePath).pipe(res);
    } catch {
        res.status(500).send('Unable to serve file');
    }
};

module.exports = {
    downloadMonthlyPdf,
    createMonthlyPdfShareLink,
    serveSharedMonthlyPdf,
    downloadDailyPdf,
    createDailyPdfShareLink
};
