const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const billingService = require('../services/billingService');
const businessService = require('../services/businessService');
const Expense = require('../models/Expense');
const Sale = require('../models/Sale');
const Stock = require('../models/Stock');

const SHARED_DIR = path.join(__dirname, '..', 'temp', 'shared-reports');
const SHARED_TTL_MS = 30 * 60 * 1000;
const WATERMARK_PATH = (() => {
    const candidates = ['ganesh.png', 'ganesh.jpg'];
    for (const name of candidates) {
        const p = path.join(__dirname, '..', 'assets', name);
        if (fs.existsSync(p)) return p;
    }
    return path.join(__dirname, '..', 'assets', 'ganesh.png'); // fallback
})();

// Font paths for unicode support (Indian Rupee symbol)
const FONT_REG_PATH = 'C:/Windows/Fonts/segoeui.ttf';
const FONT_BOLD_PATH = 'C:/Windows/Fonts/segoeuib.ttf';

const getFont = (bold = false) => {
    const p = bold ? FONT_BOLD_PATH : FONT_REG_PATH;
    if (fs.existsSync(p)) return p;
    return bold ? 'Helvetica-Bold' : 'Helvetica';
};

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
            // ignore
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

const drawWatermarkOnPage = (doc) => {
    try {
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
        // silently skip
    }
};

const attachWatermark = (doc) => {
    drawWatermarkOnPage(doc);
    doc.on('pageAdded', () => {
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

const drawMonthlySummaryCards = (doc, startX, startY, width, summary) => {
    const gap = 12;
    const colWidth = (width - gap) / 2;
    const cards = summary.cards || {};
    const items = [
        { label: 'TOTAL STOCK WEIGHT', value: `${num3(cards.totalStockWeight || 0)} g`, color: '#64748B' },
        { label: 'MONTHLY SALES BILLS', value: cards.monthlySalesBills || 0, color: '#64748B' },
        { label: 'CASH BALANCE', value: `₹${Number(cards.cashBalance || 0).toLocaleString('en-IN')}`, color: '#64748B' },
        { label: 'EXPENSES TOTAL', value: `₹${Number(summary.expensesTotal || 0).toLocaleString('en-IN')}`, color: '#EF4444' }
    ];

    let currentY = startY;
    for (let i = 0; i < items.length; i += 2) {
        const rowItems = items.slice(i, i + 2);
        rowItems.forEach((item, idx) => {
            const x = startX + (idx * (colWidth + gap));
            doc.rect(x, currentY, colWidth, 60).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
            doc.font(getFont(true)).fontSize(8.5).fillColor('#64748B').text(item.label, x + 12, currentY + 12);
            doc.font(getFont(true)).fontSize(16).fillColor(item.color).text(String(item.value), x + 12, currentY + 30);
        });
        currentY += 60 + gap;
    }
    return currentY;
};

const drawProfitBoxes = (doc, startX, startY, width, data) => {
    const gap = 8;
    const colWidth = (width - (gap * 3)) / 4;
    const items = [
        { label: 'SALES PROFIT', value: `${num3(data.salesProfit)} g`, color: '#111827' },
        { label: 'EXPENSES (₹)', value: `₹${Number(data.expenses).toLocaleString('en-IN')}`, color: '#EF4444' },
        { label: 'PROFIT GOLD RATE', value: `₹${Number(data.goldRate).toLocaleString('en-IN')}/g`, color: '#111827' },
        { label: 'NET PROFIT', value: `${num3(data.netProfit)} g`, color: '#4F46E5', bgColor: '#F5F3FF' }
    ];

    items.forEach((item, idx) => {
        const x = startX + (idx * (colWidth + gap));
        if (item.bgColor) {
            doc.save();
            doc.rect(x, startY, colWidth, 50).fill(item.bgColor);
            doc.restore();
        }
        doc.rect(x, startY, colWidth, 50).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
        doc.font(getFont(true)).fontSize(7.5).fillColor('#64748B').text(item.label, x + 8, startY + 10);
        doc.font(getFont(true)).fontSize(11).fillColor(item.color).text(String(item.value), x + 8, startY + 26);
    });
    return startY + 50;
};

const createTableRenderer = (doc, margins) => {
    const pageBottom = () => doc.page.height - margins.bottom;
    const pageWidth = () => doc.page.width - margins.left - margins.right;
    let y = doc.y || margins.top;

    const ensureSpace = (requiredHeight) => {
        if (y + requiredHeight > pageBottom()) {
            doc.addPage();
            y = margins.top;
            return true;
        }
        return false;
    };

    const drawSectionTitle = (title) => {
        ensureSpace(35);
        doc.font(getFont(true)).fontSize(12).fillColor('#111827').text(title, margins.left, y + 5);
        y += 26;
    };

    const drawTable = ({ headers, rows, widths, aligns = [], totalsRow = null, totalHolding = false }) => {
        const totalW = widths.reduce((a, b) => a + b, 0);
        const scale = totalW > pageWidth() ? pageWidth() / totalW : 1;
        const scaledWidths = widths.map((w) => w * scale);

        const rowPadding = 6;
        const fontSize = 8;

        const getRowHeight = (row, isHeader = false) => {
            let maxHeight = isHeader ? 24 : 20;
            doc.font(getFont(isHeader)).fontSize(fontSize);
            for (let i = 0; i < row.length; i += 1) {
                const text = String(row[i] || '');
                const cellHeight = doc.heightOfString(text, {
                    width: scaledWidths[i] - 12
                }) + (rowPadding * 2);
                if (cellHeight > maxHeight) maxHeight = cellHeight;
            }
            return maxHeight;
        };

        const drawRow = (row, currentY, isHeader = false, isTotal = false) => {
            const h = getRowHeight(row, isHeader);
            let x = margins.left;

            if (isHeader) {
                doc.rect(margins.left, currentY, scaledWidths.reduce((a, b) => a + b, 0), h).fillAndStroke('#F8FAFC', '#E2E8F0');
            } else if (isTotal) {
                const rowLabel = String(row[0] || '');
                const isSpecial = totalHolding || rowLabel.includes('TOTAL BUSINESS') || rowLabel.includes('TOTAL');
                const totalColor = isSpecial ? '#FEF3C7' : '#F8FAFC';
                const strokeColor = '#E2E8F0';
                doc.rect(margins.left, currentY, scaledWidths.reduce((a, b) => a + b, 0), h).fillAndStroke(totalColor, strokeColor);
            }

            for (let i = 0; i < row.length; i += 1) {
                const value = row[i] !== undefined && row[i] !== null ? String(row[i]) : '';
                const strokeColor = '#E2E8F0';
                doc.rect(x, currentY, scaledWidths[i], h).stroke(strokeColor);

                let textColor = '#111827';
                if (isHeader) textColor = '#475569';
                if (String(value) === 'Addition') textColor = '#059669';
                if (String(value) === 'Subtraction') textColor = '#DC2626';

                doc.font(getFont(isHeader || isTotal)).fontSize(fontSize).fillColor(textColor);

                // Vertical alignment fix
                const textH = doc.heightOfString(value, { width: scaledWidths[i] - 12 });
                const verticalOffset = (h - textH) / 2;

                doc.text(value, x + 6, currentY + verticalOffset, {
                    width: scaledWidths[i] - 12,
                    align: aligns[i] || 'left'
                });
                x += scaledWidths[i];
            }
            return h;
        };

        const headerH = getRowHeight(headers, true);
        ensureSpace(headerH + 20);
        y += drawRow(headers, y, true);

        for (const row of rows) {
            const h = getRowHeight(row);
            if (y + h > pageBottom()) {
                doc.addPage();
                y = margins.top;
                y += drawRow(headers, y, true);
            }
            y += drawRow(row, y);
        }

        if (totalsRow) {
            const th = getRowHeight(totalsRow);
            if (y + th > pageBottom()) {
                doc.addPage();
                y = margins.top;
                y += drawRow(headers, y, true);
            }
            y += drawRow(totalsRow, y, false, true);
        }
        y += 15;
    };

    return { drawSectionTitle, drawTable, ensureSpace, setY: (newY) => { y = newY; }, getY: () => y, pageWidth, pageBottom };
};

const writeMonthlyPdf = (doc, summary, month) => {
    attachWatermark(doc);
    const margins = { top: 50, left: 50, right: 50, bottom: 50 };
    const renderer = createTableRenderer(doc, margins);
    const generatedAt = new Date();

    doc.font(getFont(true)).fontSize(18).fillColor('#111827').text('SRI VAISHNAVI JEWELLERS', margins.left, margins.top, {
        width: renderer.pageWidth(),
        align: 'center'
    });
    doc.font(getFont(true)).fontSize(10).fillColor('#111827').text(`Monthly Billing Summary - ${month}`, margins.left, margins.top + 22, {
        width: renderer.pageWidth(),
        align: 'center'
    });
    doc.font(getFont(false)).fontSize(8).fillColor('#64748B').text(`Generated on: ${generatedAt.toLocaleString('en-IN')}`, margins.left, margins.top + 34, {
        width: renderer.pageWidth(),
        align: 'center'
    });

    const summaryY = margins.top + 55;
    const summaryBottom = drawMonthlySummaryCards(doc, margins.left, summaryY, renderer.pageWidth(), summary);
    renderer.setY(summaryBottom + 15);

    renderer.drawSectionTitle('1. CUSTOMER SALES');
    renderer.drawTable({
        headers: ['Customer', 'Phone', 'Date', 'Time', 'Bill No', 'Item', 'Weight', 'Sri Cost', 'Sri Bill', 'Sri Plus'],
        rows: (summary.customerSales || []).map((r) => [
            r.customerName || '-', r.phoneNumber || '-', fmtDate(r.date), r.time || '-', r.billNumber || '-', r.itemName || '-',
            num3(r.weight), num3(r.sriCost), num3(r.sriBill), num3(r.plus)
        ]),
        widths: [80, 75, 60, 45, 55, 80, 50, 50, 50, 50],
        aligns: ['left', 'left', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right']
    });

    renderer.drawSectionTitle('2. PLUS SUMMARY');
    renderer.drawTable({
        headers: ['Plus %', 'Total Weight', 'Profit (g)'],
        rows: (summary.plusSummary || []).map((r) => [`${num3(r.plus)}%`, `${num3(r.totalWeight)}g`, `${num3(r.profit)}g`]),
        widths: [150, 150, 150],
        aligns: ['center', 'center', 'center'],
        totalsRow: ['TOTAL', `${num3(summary.plusSummaryTotals?.totalWeight)}g`, `${num3(summary.plusSummaryTotals?.totalProfit)}g`]
    });

    renderer.drawSectionTitle('3. DEBT RECEIVABLE');
    renderer.drawTable({
        headers: ['Name', 'Phone', 'Grams'],
        rows: (summary.debtReceivable || []).map((r) => [r.name || '-', r.phoneNumber || '-', `${num3(r.amount)}g`]),
        widths: [180, 150, 120],
        aligns: ['left', 'left', 'right'],
        totalsRow: ['TOTAL', '', `${num3(summary.debtReceivableTotal || 0)}g`]
    });

    renderer.drawSectionTitle('4. DEBT PAYABLE');
    renderer.drawTable({
        headers: ['Name', 'Phone', 'Grams'],
        rows: (summary.debtPayable || []).map((r) => [r.name || '-', r.phoneNumber || '-', `${num3(r.amount)}g`]),
        widths: [180, 150, 120],
        aligns: ['left', 'left', 'right'],
        totalsRow: ['TOTAL', '', `${num3(summary.debtPayableTotal || 0)}g`]
    });

    renderer.drawSectionTitle('5. EXPENSES');
    renderer.drawTable({
        headers: ['Date', 'Name', 'Amount'],
        rows: (summary.expenses || []).map((r) => [fmtDate(r.expenseDate), r.expenseName || '-', `₹${Number(r.amount || 0).toLocaleString('en-IN')}`]),
        widths: [130, 200, 120],
        aligns: ['left', 'left', 'right'],
        totalsRow: ['TOTAL', '', `₹${Number(summary.expensesTotal || 0).toLocaleString('en-IN')}`]
    });

    renderer.drawSectionTitle('6. CHIT FUNDS');
    renderer.drawTable({
        headers: ['Date', 'Amount', 'Grams'],
        rows: (summary.chitFunds || []).map((r) => [fmtDate(r.date), `₹${Number(r.amount || 0).toLocaleString('en-IN')}`, `${num3(r.gramsPurchased)}g`]),
        widths: [140, 140, 140],
        aligns: ['left', 'right', 'right'],
        totalsRow: ['TOTAL', `₹${Number(summary.chitFundsTotal || 0).toLocaleString('en-IN')}`, `${num3(summary.chitFundsGrams || 0)}g`]
    });

    if (summary.otherTransactions && summary.otherTransactions.length > 0) {
        renderer.drawSectionTitle('7. OTHERS');
        const oRows = summary.otherTransactions.map(r => [fmtDate(r.date), r.name || '-', r.description || '-', `${num3(r.grams)}g`, `₹${Number(r.amount || 0).toLocaleString('en-IN')}`]);
        const oTotals = summary.otherTransactions.reduce((acc, r) => {
            const g = Number(r.grams || 0), a = Number(r.amount || 0);
            if (r.type === 'Addition') { acc.grams += g; acc.amount += a; }
            else { acc.grams -= g; acc.amount -= a; }
            return acc;
        }, { grams: 0, amount: 0 });
        renderer.drawTable({
            headers: ['Date', 'Name', 'Description', 'Grams', 'Amount'],
            rows: oRows,
            widths: [75, 80, 145, 75, 75],
            aligns: ['left', 'left', 'left', 'right', 'right'],
            totalsRow: ['NET TOTAL', '', '', `${num3(oTotals.grams)}g`, `₹${Number(oTotals.amount).toLocaleString('en-IN')}`]
        });
    }

    renderer.drawSectionTitle('8. BUSINESS CALCULATION SUMMARY');
    try {
        const bD = summary.businessData || {};
        const bS = bD.summary || {};
        const bSettings = bD.settings || {};
        const gR = Number(bSettings.goldRate || 0);
        const sW = Number(summary.cards?.totalStockWeight || 0);
        const cb = Number(summary.cards?.cashBalance || 0);
        const sriPct = Number(bSettings.sriBillPercentage || 87);

        // Recalculate on-the-fly in PDF to ensure it matches what user sees/expects
        const aStock = Number(sW * (sriPct / 100));
        const cConv = gR > 0 ? Number(cb / gR) : 0;
        const dRec = Number(summary.debtReceivableTotal || 0);
        const dPay = Number(summary.debtPayableTotal || 0);
        const cColl = Number(summary.chitFundsGrams || 0);
        const otherT = Array.isArray(summary.otherTransactions) ? summary.otherTransactions : [];
        const otherGSum = otherT.reduce((acc, t) => t ? (t.type === 'Addition' ? acc + Number(t.grams || 0) : acc - Number(t.grams || 0)) : acc, 0);
        const tHold = aStock + cConv + dRec + otherGSum - dPay - cColl;

        const bRows = [
            ['Adjusted Stock (+)', `Total Stock weight (${num3(sW)}g) * SRI Bill % (${sriPct}%)`, `${num3(aStock)}g`],
            ['Cash converted (+)', `Cash Balance (₹${cb.toLocaleString('en-IN')}) / Gold Rate (₹${gR.toLocaleString('en-IN')})`, `${num3(cConv)}g`],
            ['Debt Receivable (+)', 'Total amount to be received in grams', `${num3(dRec)}g`],
            ['Debt Payable (-)', 'Total amount to be paid in grams', `${num3(dPay)}g`],
            ['Chit collection (-)', 'Total grams purchased via chit funds', `${num3(cColl)}g`]
        ];
        otherT.forEach(t => {
            if (t) {
                const pre = t.type === 'Addition' ? '+' : '-';
                bRows.push([`${t.name} (${pre})`, t.description || '-', `${pre}${num3(t.grams)}g`]);
            }
        });

        renderer.drawTable({
            headers: ['Component', 'Description', 'Grams'],
            rows: bRows,
            widths: [120, 240, 100],
            aligns: ['left', 'left', 'right'],
            totalHolding: true,
            totalsRow: ['TOTAL BUSINESS HOLDING', '', `${num3(tHold)} g`]
        });

        renderer.drawSectionTitle('9. PROFIT SECTION');
        const sP = Number(summary.plusSummaryTotals?.totalProfit || 0);
        const exT = Number(summary.expensesTotal || 0);
        const pGR = Number(bSettings.profitGoldRate || gR || 0);
        const nP = pGR > 0 ? (sP - (exT / pGR)) : sP;

        drawProfitBoxes(doc, margins.left, renderer.getY(), renderer.pageWidth(), {
            salesProfit: sP,
            expenses: exT,
            goldRate: pGR,
            netProfit: nP
        });

    } catch (e) {
        console.error('PDF section 8/9 failed:', e);
        doc.font(getFont(false)).fontSize(9).fillColor('#EF4444').text(`Note: Calculation details failed: ${e.message}`, margins.left);
    }

    // Footer
    const lastY = doc.y + 60;
    if (lastY < doc.page.height - 40) {
        doc.font(getFont(false)).fontSize(7).fillColor('#94A3B8').text('© 2026 Sri Vaishnavi Jewellers. All rights reserved.', margins.left, doc.page.height - 40, { align: 'center', width: renderer.pageWidth() });
    }
};

const writeDailyPdf = (doc, summary, dateString, expenses, expensesTotal) => {
    attachWatermark(doc);
    const margins = { top: 50, left: 50, right: 50, bottom: 50 };
    const renderer = createTableRenderer(doc, margins);
    const generatedAt = new Date();

    doc.font(getFont(true)).fontSize(18).fillColor('#111827').text('SRI VAISHNAVI JEWELLERS', margins.left, margins.top, {
        width: renderer.pageWidth(),
        align: 'center'
    });
    doc.font(getFont(true)).fontSize(10).fillColor('#111827').text(`Daily Billing Summary - ${dateString}`, margins.left, margins.top + 22, {
        width: renderer.pageWidth(),
        align: 'center'
    });
    doc.font(getFont(false)).fontSize(8).fillColor('#64748B').text(`Generated on: ${generatedAt.toLocaleString('en-IN')}`, margins.left, margins.top + 34, {
        width: renderer.pageWidth(),
        align: 'center'
    });

    const dailyCards = {
        totalItems: summary.cards?.totalStockItems || 0,
        totalWeight: summary.cards?.totalStockWeight || 0,
        dailyBills: summary.cards?.dailySalesBills || 0,
        cashBalance: summary.cards?.cashBalance || 0
    };

    const gap = 12;
    const colWidth = (renderer.pageWidth() - gap) / 2;
    const items = [
        { label: 'TOTAL ITEMS', value: dailyCards.totalItems, color: '#64748B' },
        { label: 'TOTAL WEIGHT', value: `${num3(dailyCards.totalWeight)} g`, color: '#64748B' },
        { label: 'DAILY BILLS', value: dailyCards.dailyBills, color: '#64748B' },
        { label: 'CASH BALANCE', value: `₹${Number(dailyCards.cashBalance).toLocaleString('en-IN')}`, color: '#64748B' }
    ];
    let curY = margins.top + 55;
    for (let i = 0; i < items.length; i += 2) {
        items.slice(i, i + 2).forEach((item, idx) => {
            const x = margins.left + (idx * (colWidth + gap));
            doc.rect(x, curY, colWidth, 60).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
            doc.font(getFont(true)).fontSize(8.5).fillColor('#64748B').text(item.label, x + 12, curY + 12);
            doc.font(getFont(true)).fontSize(16).fillColor(item.color).text(String(item.value), x + 12, curY + 30);
        });
        curY += 60 + gap;
    }
    renderer.setY(curY + 15);

    renderer.drawSectionTitle('1. CUSTOMER SALES');
    renderer.drawTable({
        headers: ['Customer', 'Phone', 'Date', 'Time', 'Bill No', 'Item', 'Weight', 'Sri Cost', 'Sri Bill', 'Sri Plus'],
        rows: (summary.customerSales || []).map((r) => [
            r.customerName || '-', r.phoneNumber || '-', fmtDate(r.date), r.time || '-', r.billNumber || '-', r.itemName || '-',
            num3(r.weight), num3(r.sriCost), num3(r.sriBill), num3(r.plus)
        ]),
        widths: [80, 75, 60, 45, 55, 80, 50, 50, 50, 50],
        aligns: ['left', 'left', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right']
    });

    renderer.drawSectionTitle('2. CUSTOMER PLUS SUMMARY');
    renderer.drawTable({
        headers: ['Plus %', 'Total Weight', 'Profit (g)'],
        rows: (summary.plusSummary || []).map((r) => [`${num3(r.plus)}%`, `${num3(r.totalWeight)}g`, `${num3(r.profit)}g`]),
        widths: [150, 150, 150],
        aligns: ['center', 'center', 'center'],
        totalsRow: ['TOTAL', `${num3(summary.plusSummaryTotals?.totalWeight)}g`, `${num3(summary.plusSummaryTotals?.totalProfit)}g`]
    });

    const dPT = (summary.debtPayable || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const dRT = (summary.debtReceivable || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);

    renderer.drawSectionTitle('3. DEBT PAYABLE');
    renderer.drawTable({
        headers: ['Name', 'Phone', 'Grams'],
        rows: (summary.debtPayable || []).map((r) => [r.name || '-', r.phoneNumber || '-', `${num3(r.amount)}g`]),
        widths: [180, 150, 120],
        aligns: ['left', 'left', 'right'],
        totalsRow: ['TOTAL', '', `${num3(dPT)}g`]
    });

    renderer.drawSectionTitle('4. DEBT RECEIVABLE');
    renderer.drawTable({
        headers: ['Name', 'Phone', 'Grams'],
        rows: (summary.debtReceivable || []).map((r) => [r.name || '-', r.phoneNumber || '-', `${num3(r.amount)}g`]),
        widths: [180, 150, 120],
        aligns: ['left', 'left', 'right'],
        totalsRow: ['TOTAL', '', `${num3(dRT)}g`]
    });

    renderer.drawSectionTitle('5. DAILY EXPENSES');
    renderer.drawTable({
        headers: ['Expense Name', 'Type', 'Time', 'Amount', 'Notes'],
        rows: (expenses || []).map((r) => [r.expenseName || '-', r.expenseType || '-', r.expenseTime || '-', `₹${Number(r.amount).toLocaleString('en-IN')}`, r.notes || '-']),
        widths: [160, 80, 80, 80, 190],
        aligns: ['left', 'left', 'left', 'right', 'left'],
        totalsRow: ['TOTAL', '', '', `₹${Number(expensesTotal || 0).toLocaleString('en-IN')}`, '']
    });

    renderer.drawSectionTitle('6. CHIT FUNDS');
    renderer.drawTable({
        headers: ['Date', 'Amount', 'Grams'],
        rows: (summary.chitFunds || []).map(r => [fmtDate(r.date), `₹${Number(r.amount || 0).toLocaleString('en-IN')}`, `${num3(r.gramsPurchased)}g`]),
        widths: [140, 140, 140],
        aligns: ['left', 'right', 'right'],
        totalsRow: ['TOTAL', `₹${Number(summary.chitFundsTotal || 0).toLocaleString('en-IN')}`, `${num3(summary.chitFundsGrams || 0)}g`]
    });

    renderer.drawSectionTitle('7. OTHERS');
    const oItems = Array.isArray(summary.otherTransactions) ? summary.otherTransactions : [];
    const oRows = oItems.map(r => [fmtDate(r.date), r.name || '-', r.description || '-', `${num3(r.grams)}g`, `₹${Number(r.amount || 0).toLocaleString('en-IN')}`]);
    const oTotals = oItems.reduce((acc, r) => {
        const g = Number(r.grams || 0), a = Number(r.amount || 0);
        if (r.type === 'Addition') { acc.grams += g; acc.amount += a; }
        else { acc.grams -= g; acc.amount -= a; }
        return acc;
    }, { grams: 0, amount: 0 });
    renderer.drawTable({
        headers: ['Date', 'Name', 'Description', 'Grams', 'Amount'],
        rows: oRows,
        widths: [75, 80, 145, 75, 75],
        aligns: ['left', 'left', 'left', 'right', 'right'],
        totalsRow: ['NET TOTAL', '', '', `${num3(oTotals.grams)}g`, `₹${Number(oTotals.amount).toLocaleString('en-IN')}`]
    });

    // Footer
    const lastY = doc.y + 40;
    if (lastY < doc.page.height - 40) {
        doc.font(getFont(false)).fontSize(7).fillColor('#94A3B8').text('© 2026 Sri Vaishnavi Jewellers. All rights reserved.', margins.left, doc.page.height - 40, { align: 'center', width: renderer.pageWidth() });
    }
};

const buildPhone = (value) => String(value || '').replace(/\D/g, '');

const downloadMonthlyPdf = async (req, res) => {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const rawSummary = await billingService.getMonthlyBillingSummary(month);
        const summary = JSON.parse(JSON.stringify(rawSummary));
        try {
            const bizData = await businessService.getSummary(month);
            // Use query parameters as overrides if provided to ensure PDF matches current screen state
            summary.businessData = {
                summary: bizData.summary || {},
                settings: {
                    sriBillPercentage: (req.query.sriBillPercentage !== undefined && req.query.sriBillPercentage !== '') ? Number(req.query.sriBillPercentage) : (bizData.settings?.sriBillPercentage || 87),
                    goldRate: (req.query.goldRate !== undefined && req.query.goldRate !== '') ? Number(req.query.goldRate) : (bizData.settings?.goldRate || 0),
                    profitGoldRate: (req.query.profitGoldRate !== undefined && req.query.profitGoldRate !== '') ? Number(req.query.profitGoldRate) : (bizData.settings?.profitGoldRate || bizData.settings?.goldRate || 0)
                }
            };
        } catch (bizError) {
            console.error('Error fetching business stats for PDF:', bizError);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="monthly-billing-summary-${month}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 50 });
        doc.pipe(res);
        writeMonthlyPdf(doc, summary, month);
        doc.end();
    } catch (error) {
        console.error('Critical PDF generation error:', error);
        if (!res.headersSent) {
            const status = /Invalid month/.test(error.message) ? 400 : 500;
            res.status(status).json({ success: false, message: error.message || 'Failed to generate PDF' });
        }
    }
};

const createMonthlyPdfShareLink = async (req, res) => {
    try {
        cleanupOldSharedFiles();
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const phone = buildPhone(req.query.phone);
        const rawSummary = await billingService.getMonthlyBillingSummary(month);
        const summary = JSON.parse(JSON.stringify(rawSummary));
        try {
            const bizData = await businessService.getSummary(month);
            // Use query parameters as overrides if provided to ensure PDF matches current screen state
            summary.businessData = {
                summary: bizData.summary || {},
                settings: {
                    sriBillPercentage: (req.query.sriBillPercentage !== undefined && req.query.sriBillPercentage !== '') ? Number(req.query.sriBillPercentage) : (bizData.settings?.sriBillPercentage || 87),
                    goldRate: (req.query.goldRate !== undefined && req.query.goldRate !== '') ? Number(req.query.goldRate) : (bizData.settings?.goldRate || 0),
                    profitGoldRate: (req.query.profitGoldRate !== undefined && req.query.profitGoldRate !== '') ? Number(req.query.profitGoldRate) : (bizData.settings?.profitGoldRate || bizData.settings?.goldRate || 0)
                }
            };
        } catch (bError) {
            console.error('Error fetching business stats for PDF:', bError);
        }

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

        res.status(200).json({ success: true, data: { fileUrl, whatsappUrl, expiresInMinutes: 30 } });
    } catch (error) {
        console.error('Critical PDF share link error:', error);
        if (!res.headersSent) {
            const status = /Invalid month/.test(error.message) ? 400 : 500;
            res.status(status).json({ success: false, message: error.message || 'Failed to create share link' });
        }
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
        const rawSummary = await billingService.getBillingSummary(date);
        const summary = JSON.parse(JSON.stringify(rawSummary));
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
        const rawSummary = await billingService.getBillingSummary(date);
        const summary = JSON.parse(JSON.stringify(rawSummary));
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

        res.status(200).json({ success: true, data: { fileUrl, whatsappUrl, expiresInMinutes: 30 } });
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
            try { fs.unlinkSync(filePath); } catch { }
            return res.status(410).send('File expired');
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="monthly-billing-summary.pdf"`);
        fs.createReadStream(filePath).pipe(res);
    } catch {
        res.status(500).send('Unable to serve file');
    }
};

const downloadStockPdf = async (req, res) => {
    try {
        const { jewelleryType, saleType } = req.query;
        let filters = {};
        if (jewelleryType && jewelleryType !== 'All') filters.jewelleryType = jewelleryType;
        if (saleType && saleType !== 'All') filters.saleType = saleType;

        const stocks = await Stock.find(filters).sort({ serialNo: 1 });
        const generatedAt = new Date();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="stock-report-${generatedAt.toISOString().slice(0, 10)}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
        doc.pipe(res);
        attachWatermark(doc);
        const margins = { top: 40, left: 40, right: 40, bottom: 40 };
        const renderer = createTableRenderer(doc, margins);

        doc.font(getFont(true)).fontSize(18).fillColor('#111827').text('SRI VAISHNAVI JEWELLERS', margins.left, margins.top, {
            width: renderer.pageWidth(),
            align: 'center'
        });
        doc.font(getFont(true)).fontSize(11).fillColor('#111827').text(`Stock Management Report`, margins.left, margins.top + 22, {
            width: renderer.pageWidth(),
            align: 'center'
        });
        doc.font(getFont(false)).fontSize(8).fillColor('#64748B').text(`Generated on: ${generatedAt.toLocaleString('en-IN')}`, margins.left, margins.top + 34, {
            width: renderer.pageWidth(),
            align: 'center'
        });

        renderer.setY(margins.top + 55);
        renderer.drawSectionTitle('INVENTORY DETAILS');
        renderer.drawTable({
            headers: ['Serial No', 'Item Name', 'Type', 'Category', 'Purity', 'Count', 'Weight'],
            rows: stocks.map(s => [
                s.serialNo || '-', s.itemName || '-', s.jewelleryType || '-', s.category || '-', s.purity || '-',
                s.currentCount ?? s.count, `${num3(s.netWeight)}g`
            ]),
            widths: [80, 150, 80, 80, 80, 80, 80],
            aligns: ['left', 'left', 'left', 'left', 'center', 'center', 'right']
        });

        doc.end();
    } catch (error) {
        console.error('Stock PDF Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const downloadTransactionHistoryPdf = async (req, res) => {
    try {
        const { saleType, startDate, endDate } = req.query;
        let filter = {};
        if (saleType && saleType !== 'All') filter.saleType = saleType;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const sales = await Sale.find(filter).sort({ createdAt: -1 });
        const generatedAt = new Date();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="transaction-history-${generatedAt.toISOString().slice(0, 10)}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
        doc.pipe(res);
        attachWatermark(doc);
        const margins = { top: 30, left: 30, right: 30, bottom: 30 };
        const renderer = createTableRenderer(doc, margins);

        doc.font(getFont(true)).fontSize(18).fillColor('#111827').text('SRI VAISHNAVI JEWELLERS', margins.left, margins.top, {
            width: renderer.pageWidth(),
            align: 'center'
        });
        doc.font(getFont(true)).fontSize(11).fillColor('#111827').text(`Transaction History Report`, margins.left, margins.top + 22, {
            width: renderer.pageWidth(),
            align: 'center'
        });
        doc.font(getFont(false)).fontSize(8).fillColor('#64748B').text(`Generated on: ${generatedAt.toLocaleString('en-IN')}`, margins.left, margins.top + 34, {
            width: renderer.pageWidth(),
            align: 'center'
        });

        renderer.setY(margins.top + 55);
        renderer.drawSectionTitle('SALES & RECEIPTS');
        renderer.drawTable({
            headers: ['Date', 'Customer', 'Phone', 'Sale', 'Item', 'Weight', 'Sri Bill'],
            rows: sales.flatMap(s => (s.issuedItems || []).map((item, idx) => [
                idx === 0 ? s.date : '',
                idx === 0 ? s.customerDetails?.name : '',
                idx === 0 ? s.customerDetails?.phone : '',
                s.saleType || '-',
                item.itemName || '-',
                `${num3(item.netWeight || item.weight)}g`,
                `₹${(item.sriBill || 0).toLocaleString('en-IN')}`
            ])),
            widths: [65, 120, 90, 60, 140, 90, 120],
            aligns: ['left', 'left', 'left', 'left', 'left', 'right', 'right']
        });

        doc.end();
    } catch (error) {
        console.error('Transaction PDF Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    downloadMonthlyPdf,
    createMonthlyPdfShareLink,
    serveSharedMonthlyPdf,
    downloadDailyPdf,
    createDailyPdfShareLink,
    downloadStockPdf,
    downloadTransactionHistoryPdf
};
