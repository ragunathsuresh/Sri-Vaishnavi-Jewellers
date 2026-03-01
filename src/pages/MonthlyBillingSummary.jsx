import { useEffect, useMemo, useState, useRef } from 'react';
import { Calendar, Clock, Download, Loader2, Save, Share2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../axiosConfig';
import { useDevice } from '../context/DeviceContext';

const number3 = (value) => Number(value || 0).toFixed(3);
const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toISOString().slice(0, 10);
};

const MonthlyBillingSummary = () => {
    const { isReadOnly, isMobile } = useDevice();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [now, setNow] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [summary, setSummary] = useState(null);
    const [cashInput, setCashInput] = useState('0');
    const [savingCash, setSavingCash] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Others Table State
    const [otherName, setOtherName] = useState('');
    const [otherDesc, setOtherDesc] = useState('');
    const [otherType, setOtherType] = useState('Addition');
    const [otherGrams, setOtherGrams] = useState('');
    const [otherAmount, setOtherAmount] = useState('');
    const [otherDate, setOtherDate] = useState(new Date().toISOString().slice(0, 10));
    const [addingOther, setAddingOther] = useState(false);

    // Business Calculation Engine State
    const [businessSummary, setBusinessSummary] = useState(null);
    const [businessSettings, setBusinessSettings] = useState({ sriBillPercentage: '', goldRate: '' });
    const [profitGoldRate, setProfitGoldRate] = useState('');
    const [isBusinessCalculating, setIsBusinessCalculating] = useState(false);
    const [showBusinessSection, setShowBusinessSection] = useState(true);
    const [manualAdjustments, setManualAdjustments] = useState({});
    const [manualDescriptions, setManualDescriptions] = useState({});
    const [editingRow, setEditingRow] = useState(null);

    const printRef = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchMonthlyData();
        // Sync otherDate with selectedMonth
        const todayStr = new Date().toISOString().slice(0, 7);
        if (selectedMonth === todayStr) {
            setOtherDate(new Date().toISOString().slice(0, 10));
        } else {
            setOtherDate(`${selectedMonth}-01`);
        }
    }, [selectedMonth]);

    const fetchMonthlyData = async () => {
        setLoading(true);
        setErrorMessage('');
        setInfoMessage('');
        try {
            const summaryRes = await api.get('/billing/monthly-summary', { params: { month: selectedMonth } });
            const summaryData = summaryRes.data?.data;
            setSummary(summaryData);
            setCashInput(String(summaryData?.cards?.cashBalance ?? 0));
            await fetchBusinessData();
        } catch (error) {
            console.error('Error fetching monthly billing summary:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to load monthly billing summary');
        } finally {
            setLoading(false);
        }
    };

    const fetchBusinessData = async () => {
        try {
            const res = await api.get('/business/summary', { params: { month: selectedMonth } });
            if (res.data.success) {
                setBusinessSummary(res.data.data.summary);
                if (res.data.data.settings) {
                    // We only update the summary, but keep the input boxes empty as per user request
                    // to allow manual entry every time.
                }
            }
        } catch (error) {
            console.error('Error fetching business summary:', error);
        }
    };

    const recalculateBusiness = async () => {
        setIsBusinessCalculating(true);
        setErrorMessage('');
        setInfoMessage('');
        try {
            const res = await api.post('/business/calculate', {
                month: selectedMonth,
                sriBillPercentage: Number(businessSettings.sriBillPercentage),
                goldRate: Number(businessSettings.goldRate),
                profitGoldRate: Number(profitGoldRate)
            });
            if (res.data.success) {
                setBusinessSummary(res.data.data.summary);
                setInfoMessage('Business stats recalculated successfully!');
            }
        } catch (error) {
            console.error('Error recalculating business:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to recalculate');
        } finally {
            setIsBusinessCalculating(false);
        }
    };

    const handleManualChange = (key, value, isDescription = false) => {
        if (isDescription) {
            setManualDescriptions(prev => ({ ...prev, [key]: value }));
        } else {
            setManualAdjustments(prev => ({ ...prev, [key]: value }));
        }
    };

    const saveCashBalance = async () => {
        setSavingCash(true);
        setErrorMessage('');
        setInfoMessage('');
        try {
            await api.put('/billing/cash-balance', { amount: Number(cashInput) });
            await fetchMonthlyData();
        } catch (error) {
            console.error('Error saving cash balance:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to save cash balance');
        } finally {
            setSavingCash(false);
        }
    };

    const customerSales = summary?.customerSales || [];
    const plusSummary = summary?.plusSummary || [];
    const plusTotals = summary?.plusSummaryTotals || { totalWeight: 0, totalProfit: 0 };
    const debtPayable = summary?.debtPayable || [];
    const debtReceivable = summary?.debtReceivable || [];
    const expenses = summary?.expenses || [];
    const chitFunds = summary?.chitFunds || [];
    const otherTransactions = summary?.otherTransactions || [];
    const cards = summary?.cards || {
        totalStockItems: 0,
        totalStockWeight: 0,
        monthlySalesBills: 0,
        cashBalance: 0
    };

    const debtPayableTotal = Number(summary?.debtPayableTotal || 0);
    const debtReceivableTotal = Number(summary?.debtReceivableTotal || 0);
    const expensesTotal = useMemo(
        () => Number((summary?.expensesTotal || expenses.reduce((acc, row) => acc + Number(row.amount || 0), 0)).toFixed(3)),
        [summary, expenses]
    );
    const chitFundsTotal = Number(summary?.chitFundsTotal || 0);
    const chitFundsGrams = Number(summary?.chitFundsGrams || 0);

    const otherTotals = useMemo(() => {
        return otherTransactions.reduce((acc, row) => {
            const g = Number(row.grams || 0);
            const a = Number(row.amount || 0);
            if (row.type === 'Addition') {
                acc.grams += g;
                acc.amount += a;
            } else {
                acc.grams -= g;
                acc.amount -= a;
            }
            return acc;
        }, { grams: 0, amount: 0 });
    }, [otherTransactions]);

    const buildShareText = () => {
        const textLines = [
            `Monthly Billing Summary (${selectedMonth})`,
            `Total Stock Items: ${cards.totalStockItems}`,
            `Total Stock Weight (g): ${number3(cards.totalStockWeight)}`,
            `Monthly Sales (Bills): ${cards.monthlySalesBills}`,
            `Cash Balance: ${number3(cards.cashBalance)}`,
            `Debt Payable Total: ${number3(debtPayableTotal)}`,
            `Debt Receivable Total: ${number3(debtReceivableTotal)}`,
            `Expenses Total: ${number3(expensesTotal)}`,
            `Chit Funds Total: ${number3(chitFundsTotal)}`
        ];
        return textLines.join('\n');
    };

    const handleDownloadPdf = async () => {
        setExporting(true);
        setErrorMessage('');
        setInfoMessage('');
        try {
            const response = await api.get('/reports/monthly/pdf', {
                params: {
                    month: selectedMonth,
                    sriBillPercentage: Number(businessSettings.sriBillPercentage),
                    goldRate: Number(businessSettings.goldRate),
                    profitGoldRate: Number(profitGoldRate)
                },
                responseType: 'blob'
            });

            const contentType = response.headers?.['content-type'] || '';
            if (contentType.includes('application/json')) {
                const text = await response.data.text();
                let message = 'Unable to download PDF';
                try {
                    const parsed = JSON.parse(text);
                    message = parsed?.message || message;
                } catch {
                    // ignore
                }
                throw new Error(message);
            }

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `monthly-billing-summary-${selectedMonth}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            setInfoMessage('PDF downloaded successfully.');
        } catch (error) {
            console.error('PDF download failed:', error);
            setErrorMessage(error.message || error.response?.data?.message || 'Unable to download PDF');
        } finally {
            setExporting(false);
        }
    };

    const handleWhatsAppShare = async () => {
        setExporting(true);
        setErrorMessage('');
        setInfoMessage('');
        try {
            const response = await api.get('/reports/monthly/pdf', {
                params: {
                    month: selectedMonth,
                    sriBillPercentage: Number(businessSettings.sriBillPercentage),
                    goldRate: Number(businessSettings.goldRate),
                    profitGoldRate: Number(profitGoldRate)
                },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const file = new File([blob], `monthly-summary-${selectedMonth}.pdf`, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Monthly Billing Summary - ${selectedMonth}`,
                    text: `Please find the Monthly Billing Summary for ${selectedMonth} attached.`
                });
                setInfoMessage('PDF shared successfully.');
            } else {
                window.alert('Direct file sharing is not supported on this browser. Opening WhatsApp with a download link instead.');
                const phoneInput = window.prompt('Recipient WhatsApp number:');
                const phone = phoneInput ? phoneInput.replace(/\D/g, '') : '';

                const { data } = await api.get('/reports/monthly/pdf/share-link', {
                    params: {
                        month: selectedMonth,
                        phone,
                        sriBillPercentage: Number(businessSettings.sriBillPercentage),
                        goldRate: Number(businessSettings.goldRate),
                        profitGoldRate: Number(profitGoldRate)
                    }
                });

                const fileUrl = data?.data?.fileUrl;
                if (fileUrl) {
                    const shareText = `Monthly Billing Summary (${selectedMonth}) PDF:\n${fileUrl}`;
                    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
                    const mobileUrl = phone
                        ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(shareText)}`
                        : `whatsapp://send?text=${encodeURIComponent(shareText)}`;

                    if (isMobile) {
                        window.location.href = mobileUrl;
                    } else {
                        window.open(data?.data?.whatsappUrl, '_blank', 'noopener,noreferrer');
                    }
                }
            }
        } catch (error) {
            console.error('WhatsApp share failed:', error);
            setErrorMessage(error.message || 'Unable to share via WhatsApp');
        } finally {
            setExporting(false);
        }
    };

    const handleShare = async () => {
        setExporting(true);
        try {
            const response = await api.get('/reports/monthly/pdf', {
                params: {
                    month: selectedMonth,
                    sriBillPercentage: Number(businessSettings.sriBillPercentage),
                    goldRate: Number(businessSettings.goldRate),
                    profitGoldRate: Number(profitGoldRate)
                },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const file = new File([blob], `monthly-summary-${selectedMonth}.pdf`, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Monthly Billing Summary',
                    text: `Monthly Summary for ${selectedMonth}`
                });
            } else {
                const shareText = buildShareText();
                await navigator.share({
                    title: 'Monthly Billing Summary',
                    text: shareText,
                    url: window.location.href
                });
            }
        } catch (error) {
            console.error('Share failed:', error);
            const shareText = buildShareText();
            await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
            setInfoMessage('Summary copied to clipboard.');
        } finally {
            setExporting(false);
        }
    };

    const addOtherTransaction = async (e) => {
        e.preventDefault();
        console.log('Frontend addOtherTransaction triggered');
        const g = Number(otherGrams) || 0;
        const a = Number(otherAmount) || 0;

        if (!otherDate || !otherName) {
            setErrorMessage('Date and Name are required for "Others" entry');
            return;
        }
        setAddingOther(true);
        setErrorMessage('');
        setInfoMessage('');
        try {
            console.log('Sending API request to add other transaction:', {
                date: otherDate,
                name: otherName,
                description: otherDesc,
                type: otherType,
                grams: g,
                amount: a
            });
            const res = await api.post('/billing/other-transactions', {
                date: otherDate,
                name: otherName,
                description: otherDesc,
                type: otherType,
                grams: g,
                amount: a
            });
            console.log('API Response received:', res.data);
            setOtherName('');
            setOtherDesc('');
            setOtherGrams('');
            setOtherAmount('');
            setInfoMessage('Other transaction added successfully!');
            // Force re-fetch
            await fetchMonthlyData();
        } catch (error) {
            console.error('Error adding other transaction:', error);
            const msg = error.response?.data?.message || 'Failed to add other transaction';
            setErrorMessage(msg);
            alert(`Error: ${msg}`);
        } finally {
            setAddingOther(false);
        }
    };

    const deleteOtherTransaction = async (id) => {
        if (!window.confirm('Delete this transaction?')) return;
        setErrorMessage('');
        setInfoMessage('');
        try {
            await api.delete(`/billing/other-transactions/${id}`);
            setInfoMessage('Transaction deleted.');
            await fetchMonthlyData();
        } catch (error) {
            console.error('Error deleting other transaction:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to delete transaction');
        }
    };


    return (
        <div className="p-6 md:p-8 bg-[#f7f7f5] min-h-screen">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900">Monthly Summary</h1>
                    <p className="text-sm text-gray-500 mt-1">Monthly accounting dashboard</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 flex items-center gap-2">
                        <Clock size={16} className="text-gray-500" />
                        <span className="text-sm font-bold text-gray-800">
                            {now.toLocaleDateString()} {now.toLocaleTimeString()}
                        </span>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 flex items-center gap-2">
                        <Calendar size={16} className="text-gray-500" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent outline-none text-sm font-bold text-gray-800"
                        />
                    </div>
                </div>
            </div>

            {errorMessage && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errorMessage}</div>}
            {infoMessage && <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">{infoMessage}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <div className="text-xs text-gray-500 uppercase font-black tracking-widest mb-1">Total Stock Items</div>
                    <div className="text-3xl font-black text-gray-900">{cards.totalStockItems}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <div className="text-xs text-gray-500 uppercase font-black tracking-widest mb-1">Total Stock Weight</div>
                    <div className="text-3xl font-black text-gray-900">{number3(cards.totalStockWeight)} <span className="text-sm text-gray-500">g</span></div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <div className="text-xs text-gray-500 uppercase font-black tracking-widest mb-1">Monthly Sales (Bills)</div>
                    <div className="text-3xl font-black text-gray-900">{cards.monthlySalesBills}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <div className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2">Current Amount in the Business</div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={cashInput}
                            onChange={(e) => setCashInput(e.target.value.replace(/[^0-9.]/g, ''))}
                            readOnly={isReadOnly}
                            className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] ${isReadOnly ? 'bg-gray-50' : ''}`}
                        />
                        {!isReadOnly && (
                            <button
                                onClick={saveCashBalance}
                                disabled={savingCash}
                                className="px-3 py-2 rounded-lg bg-[#b8860b] text-white font-bold disabled:opacity-60"
                            >
                                <Save size={15} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="py-16 flex items-center justify-center text-gray-500 font-bold gap-2">
                    <Loader2 className="animate-spin" size={20} /> Loading monthly billing data...
                </div>
            ) : (
                <div className="space-y-8">
                    <section className="bg-white border border-gray-200 rounded-2xl p-5 overflow-x-auto">
                        <h2 className="text-lg font-black text-gray-900 mb-4">1. Customer Sales Table</h2>
                        <table className="w-full min-w-[1100px] text-sm">
                            <thead className="text-left text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                                <tr>
                                    <th className="py-3 pr-3">Customer Name</th>
                                    <th className="py-3 pr-3">Phone Number</th>
                                    <th className="py-3 pr-3">Date</th>
                                    <th className="py-3 pr-3">Time</th>
                                    <th className="py-3 pr-3">Bill Number</th>
                                    <th className="py-3 pr-3">Item Name</th>
                                    <th className="py-3 pr-3">Weight (g)</th>
                                    <th className="py-3 pr-3">SRI Cost (%)</th>
                                    <th className="py-3 pr-3">SRI Bill (%)</th>
                                    <th className="py-3 pr-3">SRI Plus (+)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {customerSales.length === 0 ? (
                                    <tr><td colSpan="10" className="py-8 text-center text-gray-400 font-semibold">No customer sales for selected month.</td></tr>
                                ) : customerSales.map((row, idx) => (
                                    <tr key={`${row.billNumber}-${row.itemName}-${idx}`}>
                                        <td className="py-3 pr-3 font-semibold text-gray-800">{row.customerName}</td>
                                        <td className="py-3 pr-3 text-gray-700">{row.phoneNumber}</td>
                                        <td className="py-3 pr-3 text-gray-700">{row.date}</td>
                                        <td className="py-3 pr-3 text-gray-700">{row.time}</td>
                                        <td className="py-3 pr-3 text-gray-700">{row.billNumber}</td>
                                        <td className="py-3 pr-3 text-gray-700">{row.itemName}</td>
                                        <td className="py-3 pr-3 text-gray-700">{number3(row.weight)}</td>
                                        <td className="py-3 pr-3 text-gray-700">{number3(row.sriCost)}</td>
                                        <td className="py-3 pr-3 text-gray-700">{number3(row.sriBill)}</td>
                                        <td className="py-3 pr-3 font-bold text-gray-900">{number3(row.plus)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    <section className="bg-white border border-gray-200 rounded-2xl p-5 overflow-x-auto">
                        <h2 className="text-lg font-black text-gray-900 mb-4">2. Customer Plus Summary Table</h2>
                        <table className="w-full min-w-[500px] text-sm">
                            <thead className="text-left text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                                <tr>
                                    <th className="py-3 pr-3">Plus (+)</th>
                                    <th className="py-3 pr-3">Total Weight (g)</th>
                                    <th className="py-3 pr-3">Profit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {plusSummary.length === 0 ? (
                                    <tr><td colSpan="3" className="py-8 text-center text-gray-400 font-semibold">No plus summary for selected month.</td></tr>
                                ) : plusSummary.map((row, idx) => (
                                    <tr key={`${row.plus}-${idx}`}>
                                        <td className="py-3 pr-3 font-bold text-gray-900">{number3(row.plus)}</td>
                                        <td className="py-3 pr-3 text-gray-700">{number3(row.totalWeight)}</td>
                                        <td className="py-3 pr-3 text-gray-700">{number3(row.profit)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-300">
                                    <td className="py-3 pr-3 font-black text-gray-900">TOTAL</td>
                                    <td className="py-3 pr-3 font-black text-gray-900">{number3(plusTotals.totalWeight)}</td>
                                    <td className="py-3 pr-3 font-black text-gray-900">{number3(plusTotals.totalProfit)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>

                    <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="bg-white border border-gray-200 rounded-2xl p-5 overflow-x-auto">
                            <h2 className="text-lg font-black text-gray-900 mb-4">3. Debt Payable</h2>
                            <table className="w-full min-w-[420px] text-sm">
                                <thead className="text-left text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                                    <tr>
                                        <th className="py-3 pr-3">Name</th>
                                        <th className="py-3 pr-3">Phone Number</th>
                                        <th className="py-3 pr-3">Balance (g)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {debtPayable.length === 0 ? (
                                        <tr><td colSpan="3" className="py-8 text-center text-gray-400 font-semibold">No debt payable entries.</td></tr>
                                    ) : debtPayable.map((row, idx) => (
                                        <tr key={`${row.name}-${row.phoneNumber}-${idx}`}>
                                            <td className="py-3 pr-3 font-semibold text-gray-800">{row.name}</td>
                                            <td className="py-3 pr-3 text-gray-700">{row.phoneNumber}</td>
                                            <td className="py-3 pr-3 text-red-600 font-bold">{number3(row.amount)} g</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-300">
                                        <td colSpan="2" className="py-3 pr-3 font-black text-gray-900">TOTAL</td>
                                        <td className="py-3 pr-3 font-black text-red-700">{number3(debtPayableTotal)} g</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl p-5 overflow-x-auto">
                            <h2 className="text-lg font-black text-gray-900 mb-4">4. Debt Receivable</h2>
                            <table className="w-full min-w-[420px] text-sm">
                                <thead className="text-left text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                                    <tr>
                                        <th className="py-3 pr-3">Name</th>
                                        <th className="py-3 pr-3">Phone Number</th>
                                        <th className="py-3 pr-3">Balance (g)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {debtReceivable.length === 0 ? (
                                        <tr><td colSpan="3" className="py-8 text-center text-gray-400 font-semibold">No debt receivable entries.</td></tr>
                                    ) : debtReceivable.map((row, idx) => (
                                        <tr key={`${row.name}-${row.phoneNumber}-${idx}`}>
                                            <td className="py-3 pr-3 font-semibold text-gray-800">{row.name}</td>
                                            <td className="py-3 pr-3 text-gray-700">{row.phoneNumber}</td>
                                            <td className="py-3 pr-3 text-emerald-600 font-bold">{number3(row.amount)} g</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-300">
                                        <td colSpan="2" className="py-3 pr-3 font-black text-gray-900">TOTAL</td>
                                        <td className="py-3 pr-3 font-black text-emerald-700">{number3(debtReceivableTotal)} g</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </section>

                    <section className="bg-white border border-gray-200 rounded-2xl p-5 overflow-x-auto">
                        <h2 className="text-lg font-black text-gray-900 mb-4">5. Expenses (Daily + Monthly)</h2>
                        <table className="w-full min-w-[700px] text-sm">
                            <thead className="text-left text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                                <tr>
                                    <th className="py-3 pr-3">Date</th>
                                    <th className="py-3 pr-3">Expense Name</th>
                                    <th className="py-3 pr-3">Type</th>
                                    <th className="py-3 pr-3">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {expenses.length === 0 ? (
                                    <tr><td colSpan="5" className="py-8 text-center text-gray-400 font-semibold">No expenses for selected month.</td></tr>
                                ) : expenses.map((row) => (
                                    <tr key={row._id}>
                                        <td className="py-3 pr-3 text-gray-700">{formatDate(row.expenseDate)}</td>
                                        <td className="py-3 pr-3 font-semibold text-gray-800">{row.expenseName}</td>
                                        <td className="py-3 pr-3 text-gray-700">{row.expenseType}</td>
                                        <td className="py-3 pr-3 text-gray-700">{number3(row.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-300">
                                    <td colSpan="3" className="py-3 pr-3 font-black text-gray-900">TOTAL</td>
                                    <td className="py-3 pr-3 font-black text-gray-900">{number3(expensesTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>

                    <section className="bg-white border border-gray-200 rounded-2xl p-5 overflow-x-auto">
                        <h2 className="text-lg font-black text-gray-900 mb-4">6. Chit Funds</h2>
                        <div className="flex flex-wrap gap-5 mb-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3 min-w-[180px]">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Total Grams Purchased</p>
                                <p className="text-2xl font-black text-yellow-700 mt-0.5">
                                    {Number(chitFundsGrams).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                    <span className="text-sm font-semibold text-gray-500 ml-1">gms</span>
                                </p>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 min-w-[180px]">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Total Cash Collected</p>
                                <p className="text-2xl font-black text-gray-900 mt-0.5">
                                    ₹{Number(chitFundsTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                        <table className="w-full min-w-[600px] text-sm">
                            <thead className="text-left text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                                <tr>
                                    <th className="py-3 pr-3">Date</th>
                                    <th className="py-3 pr-3">Amount</th>
                                    <th className="py-3 pr-3">Grams Purchased</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {chitFunds.length === 0 ? (
                                    <tr><td colSpan="3" className="py-8 text-center text-gray-400 font-semibold">No chit funds for selected month.</td></tr>
                                ) : chitFunds.map((row) => (
                                    <tr key={row._id}>
                                        <td className="py-3 pr-3 text-gray-700">{formatDate(row.date)}</td>
                                        <td className="py-3 pr-3 font-semibold text-gray-900">{number3(row.amount)}</td>
                                        <td className="py-3 pr-3 font-extrabold text-yellow-700">{number3(row.gramsPurchased)} gms</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-300">
                                    <td className="py-3 pr-3 font-black text-gray-900">TOTAL</td>
                                    <td className="py-3 pr-3 font-black text-gray-900">{number3(chitFundsTotal)}</td>
                                    <td className="py-3 pr-3 font-black text-yellow-700">{number3(chitFundsGrams)} gms</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>

                    <section className="bg-white border border-gray-200 rounded-2xl p-5 overflow-x-auto">
                        <h2 className="text-lg font-black text-gray-900 mb-4">7. Others</h2>

                        {!isReadOnly && (
                            <form onSubmit={addOtherTransaction} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Date</label>
                                    <input type="date" value={otherDate} onChange={(e) => setOtherDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b8860b33]" required />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Name</label>
                                    <input type="text" placeholder="Name" value={otherName} onChange={(e) => setOtherName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b8860b33]" required />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Description</label>
                                    <input type="text" placeholder="Description" value={otherDesc} onChange={(e) => setOtherDesc(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b8860b33]" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Type</label>
                                    <select value={otherType} onChange={(e) => setOtherType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b8860b33]">
                                        <option value="Addition">Addition</option>
                                        <option value="Subtraction">Subtraction</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Grams</label>
                                    <input type="number" step="0.001" placeholder="Grams" value={otherGrams} onChange={(e) => setOtherGrams(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b8860b33]" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Amount</label>
                                    <input type="number" step="0.01" placeholder="Amount" value={otherAmount} onChange={(e) => setOtherAmount(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b8860b33]" />
                                </div>
                                <div className="flex flex-col gap-1 items-end justify-end">
                                    <button type="submit" disabled={addingOther} className="w-full px-4 py-2 rounded-lg bg-[#b8860b] text-white font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                                        {addingOther ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                        Add Entry
                                    </button>
                                </div>
                            </form>
                        )}

                        <table className="w-full min-w-[800px] text-sm">
                            <thead className="text-left text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                                <tr>
                                    <th className="py-3 pr-3">Date</th>
                                    <th className="py-3 pr-3">Name</th>
                                    <th className="py-3 pr-3">Description</th>
                                    <th className="py-3 pr-3">Type</th>
                                    <th className="py-3 pr-3">Grams</th>
                                    <th className="py-3 pr-3">Amount</th>
                                    <th className="py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {otherTransactions.length === 0 ? (
                                    <tr><td colSpan="6" className="py-8 text-center text-gray-400 font-semibold">No entries in "Others" table.</td></tr>
                                ) : otherTransactions.map((row) => (
                                    <tr key={row._id}>
                                        <td className="py-3 pr-3 text-gray-700">{formatDate(row.date)}</td>
                                        <td className="py-3 pr-3 font-semibold text-gray-800">{row.name}</td>
                                        <td className="py-3 pr-3 text-gray-700 max-w-[200px] truncate" title={row.description}>{row.description || '-'}</td>
                                        <td className={`py-3 pr-3 font-bold ${row.type === 'Addition' ? 'text-emerald-600' : 'text-red-600'}`}>{row.type}</td>
                                        <td className={`py-3 pr-3 font-bold ${row.type === 'Addition' ? 'text-emerald-700' : 'text-red-700'}`}>{number3(row.grams)} g</td>
                                        <td className={`py-3 pr-3 font-bold ${row.type === 'Addition' ? 'text-emerald-700' : 'text-red-700'}`}>₹{Number(row.amount || 0).toLocaleString('en-IN')}</td>
                                        {!isReadOnly && (
                                            <td className="py-3 text-right">
                                                <button onClick={() => deleteOtherTransaction(row._id)} className="text-red-500 hover:text-red-700 font-bold text-xs uppercase tracking-tighter">Delete</button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-300">
                                    <td colSpan="4" className="py-3 pr-3 font-black text-gray-900">NET TOTAL</td>
                                    <td className={`py-3 pr-3 font-black ${otherTotals.grams >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{number3(otherTotals.grams)} g</td>
                                    <td className={`py-3 pr-3 font-black ${otherTotals.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>₹{otherTotals.amount.toLocaleString('en-IN')}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </section>

                    <section className="bg-white border border-gray-200 rounded-2xl p-5 overflow-hidden">
                        <div className="flex items-center justify-between cursor-pointer mb-4" onClick={() => setShowBusinessSection(!showBusinessSection)}>
                            <h2 className="text-lg font-black text-gray-900 line-clamp-1">8. Business Calculation Summary</h2>
                            <button className="text-gray-400 hover:text-gray-600">
                                {showBusinessSection ? 'Collapse' : 'Expand'}
                            </button>
                        </div>

                        {showBusinessSection && (
                            <div className="space-y-6">
                                {/* SRI Bill % and Gold Rate Inputs */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                    <div>
                                        <label className="block text-[11px] uppercase font-black tracking-widest text-amber-700 mb-1">SRI Bill (%)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={businessSettings.sriBillPercentage}
                                                onChange={(e) => setBusinessSettings(prev => ({ ...prev, sriBillPercentage: e.target.value.replace(/[^0-9.]/g, '') }))}
                                                readOnly={isReadOnly}
                                                className={`w-full border border-amber-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-300 ${isReadOnly ? 'bg-amber-100/50' : 'bg-white'}`}
                                                placeholder="e.g. 87"
                                            />
                                            <span className="text-sm font-bold text-amber-700 whitespace-nowrap">%</span>
                                        </div>
                                        <p className="text-[10px] text-amber-600 mt-1 font-medium">Used to calculate: Stock × SRI Bill %</p>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] uppercase font-black tracking-widest text-amber-700 mb-1">Gold Rate (₹/g)</label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-amber-700">₹</span>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={businessSettings.goldRate}
                                                onChange={(e) => setBusinessSettings(prev => ({ ...prev, goldRate: e.target.value.replace(/[^0-9.]/g, '') }))}
                                                readOnly={isReadOnly}
                                                className={`w-full border border-amber-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-300 ${isReadOnly ? 'bg-amber-100/50' : 'bg-white'}`}
                                                placeholder="e.g. 6500"
                                            />
                                            <span className="text-sm font-bold text-amber-700 whitespace-nowrap">/g</span>
                                        </div>
                                        <p className="text-[10px] text-amber-600 mt-1 font-medium">Used to calculate: Cash ÷ Gold Rate</p>
                                    </div>
                                    {!isReadOnly && (
                                        <div className="md:col-span-2 flex justify-end mt-2">
                                            <button
                                                onClick={recalculateBusiness}
                                                disabled={isBusinessCalculating}
                                                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {isBusinessCalculating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                {isBusinessCalculating ? 'Calculating...' : 'Recalculate & Save Stats'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border-collapse border border-gray-200 rounded-xl overflow-hidden">
                                        <thead className="bg-gray-50 text-xs font-black text-gray-500 uppercase tracking-widest text-left">
                                            <tr>
                                                <th className="p-4 border-b border-gray-200">Component</th>
                                                <th className="p-4 border-b border-gray-200">Description</th>
                                                <th className="p-4 border-b border-gray-200">Grams</th>
                                                {!isReadOnly && <th className="p-4 border-b border-gray-200 text-right">Action</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {/* Stock Row (was Adjusted Stock) */}
                                            <tr>
                                                <td className="p-4 font-semibold text-gray-700">Stock</td>
                                                <td className="p-4 text-xs text-gray-500">
                                                    {editingRow === 'adjustedStock' ? (
                                                        <input
                                                            type="text"
                                                            value={manualDescriptions.adjustedStock ?? `${number3(cards.totalStockWeight)} g × ${businessSettings.sriBillPercentage}% = ${number3((cards.totalStockWeight || 0) * (Number(businessSettings.sriBillPercentage) / 100))} g`}
                                                            onChange={(e) => handleManualChange('adjustedStock', e.target.value, true)}
                                                            className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-gray-300"
                                                        />
                                                    ) : (
                                                        manualDescriptions.adjustedStock
                                                            ? manualDescriptions.adjustedStock
                                                            : <span className="font-mono">{number3(cards.totalStockWeight)} g × {businessSettings.sriBillPercentage}% = <span className="font-bold text-gray-800">{number3((cards.totalStockWeight || 0) * (Number(businessSettings.sriBillPercentage) / 100))} g</span></span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {editingRow === 'adjustedStock' ? (
                                                        <input
                                                            type="number"
                                                            value={manualAdjustments.adjustedStockGrams ?? (businessSummary?.adjustedStockGrams || 0)}
                                                            onChange={(e) => handleManualChange('adjustedStockGrams', e.target.value)}
                                                            className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-gray-300 font-bold"
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-gray-900">
                                                            {manualAdjustments.adjustedStockGrams !== undefined
                                                                ? number3(manualAdjustments.adjustedStockGrams)
                                                                : number3((cards.totalStockWeight || 0) * (Number(businessSettings.sriBillPercentage) / 100))}
                                                        </span>
                                                    )}
                                                </td>
                                                {!isReadOnly && (
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => setEditingRow(editingRow === 'adjustedStock' ? null : 'adjustedStock')}
                                                            className="text-xs font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800"
                                                        >
                                                            {editingRow === 'adjustedStock' ? 'Save' : 'Edit'}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                            {/* Cash Row (was Cash Converted) */}
                                            <tr>
                                                <td className="p-4 font-semibold text-gray-700">Cash</td>
                                                <td className="p-4 text-xs text-gray-500">
                                                    {editingRow === 'cashConverted' ? (
                                                        <input
                                                            type="text"
                                                            value={manualDescriptions.cashConverted ?? `₹${Number(cards.cashBalance || 0).toLocaleString('en-IN')} ÷ ₹${businessSettings.goldRate}/g = ${number3(Number(businessSettings.goldRate) > 0 ? (cards.cashBalance || 0) / Number(businessSettings.goldRate) : 0)} g`}
                                                            onChange={(e) => handleManualChange('cashConverted', e.target.value, true)}
                                                            className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-gray-300"
                                                        />
                                                    ) : (
                                                        manualDescriptions.cashConverted
                                                            ? manualDescriptions.cashConverted
                                                            : <span className="font-mono">₹{Number(cards.cashBalance || 0).toLocaleString('en-IN')} ÷ ₹{Number(businessSettings.goldRate).toLocaleString('en-IN')}/g = <span className="font-bold text-gray-800">{number3(Number(businessSettings.goldRate) > 0 ? (cards.cashBalance || 0) / Number(businessSettings.goldRate) : 0)} g</span></span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {editingRow === 'cashConverted' ? (
                                                        <input
                                                            type="number"
                                                            value={manualAdjustments.cashConvertedGrams ?? (businessSummary?.cashConvertedGrams || 0)}
                                                            onChange={(e) => handleManualChange('cashConvertedGrams', e.target.value)}
                                                            className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-gray-300 font-bold"
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-emerald-600">
                                                            {manualAdjustments.cashConvertedGrams !== undefined
                                                                ? number3(manualAdjustments.cashConvertedGrams)
                                                                : number3(Number(businessSettings.goldRate) > 0 ? (cards.cashBalance || 0) / Number(businessSettings.goldRate) : 0)}
                                                        </span>
                                                    )}
                                                </td>
                                                {!isReadOnly && (
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => setEditingRow(editingRow === 'cashConverted' ? null : 'cashConverted')}
                                                            className="text-xs font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800"
                                                        >
                                                            {editingRow === 'cashConverted' ? 'Save' : 'Edit'}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                            {/* Debt Receivable */}
                                            <tr>
                                                <td className="p-4 font-semibold text-gray-700">Debt Receivable (+)</td>
                                                <td className="p-4 text-xs text-gray-500">
                                                    {editingRow === 'debtReceivable' ? (
                                                        <input
                                                            type="text"
                                                            value={manualDescriptions.debtReceivable ?? 'Total amount to be received in grams'}
                                                            onChange={(e) => handleManualChange('debtReceivable', e.target.value, true)}
                                                            className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-gray-300"
                                                        />
                                                    ) : (
                                                        manualDescriptions.debtReceivable ?? 'Total amount to be received in grams'
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {editingRow === 'debtReceivable' ? (
                                                        <input
                                                            type="number"
                                                            value={manualAdjustments.debtReceivableGrams ?? debtReceivableTotal}
                                                            onChange={(e) => handleManualChange('debtReceivableGrams', e.target.value)}
                                                            className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-gray-300 font-bold"
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-emerald-600">{number3(manualAdjustments.debtReceivableGrams ?? debtReceivableTotal)}</span>
                                                    )}
                                                </td>
                                                {!isReadOnly && (
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => setEditingRow(editingRow === 'debtReceivable' ? null : 'debtReceivable')}
                                                            className="text-xs font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800"
                                                        >
                                                            {editingRow === 'debtReceivable' ? 'Save' : 'Edit'}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                            {/* Debt Payable */}
                                            <tr>
                                                <td className="p-4 font-semibold text-gray-700">Debt Payable (-)</td>
                                                <td className="p-4 text-xs text-gray-500">
                                                    {editingRow === 'debtPayable' ? (
                                                        <input
                                                            type="text"
                                                            value={manualDescriptions.debtPayable ?? 'Total amount to be paid in grams'}
                                                            onChange={(e) => handleManualChange('debtPayable', e.target.value, true)}
                                                            className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-gray-300"
                                                        />
                                                    ) : (
                                                        manualDescriptions.debtPayable ?? 'Total amount to be paid in grams'
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {editingRow === 'debtPayable' ? (
                                                        <input
                                                            type="number"
                                                            value={manualAdjustments.debtPayableGrams ?? debtPayableTotal}
                                                            onChange={(e) => handleManualChange('debtPayableGrams', e.target.value)}
                                                            className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-gray-300 font-bold"
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-red-600">{number3(manualAdjustments.debtPayableGrams ?? debtPayableTotal)}</span>
                                                    )}
                                                </td>
                                                {!isReadOnly && (
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => setEditingRow(editingRow === 'debtPayable' ? null : 'debtPayable')}
                                                            className="text-xs font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800"
                                                        >
                                                            {editingRow === 'debtPayable' ? 'Save' : 'Edit'}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                            {/* Chit Collection */}
                                            <tr>
                                                <td className="p-4 font-semibold text-gray-700">Chit funds collection (-)</td>
                                                <td className="p-4 text-xs text-gray-500">
                                                    {editingRow === 'chitCollection' ? (
                                                        <input
                                                            type="text"
                                                            value={manualDescriptions.chitCollection ?? 'Total grams purchased via chit funds'}
                                                            onChange={(e) => handleManualChange('chitCollection', e.target.value, true)}
                                                            className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-gray-300"
                                                        />
                                                    ) : (
                                                        manualDescriptions.chitCollection ?? 'Total grams purchased via chit funds'
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {editingRow === 'chitCollection' ? (
                                                        <input
                                                            type="number"
                                                            value={manualAdjustments.chitCollectionGrams ?? chitFundsGrams}
                                                            onChange={(e) => handleManualChange('chitCollectionGrams', e.target.value)}
                                                            className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-gray-300 font-bold"
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-red-600">{number3(manualAdjustments.chitCollectionGrams ?? chitFundsGrams)}</span>
                                                    )}
                                                </td>
                                                {!isReadOnly && (
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => setEditingRow(editingRow === 'chitCollection' ? null : 'chitCollection')}
                                                            className="text-xs font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800"
                                                        >
                                                            {editingRow === 'chitCollection' ? 'Save' : 'Edit'}
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                            {/* Other Transactions Breakdown */}
                                            {summary?.otherTransactions?.map(t => (
                                                <tr key={t._id}>
                                                    <td className="p-4 font-semibold text-gray-700">{t.name} ({t.type === 'Addition' ? '+' : '-'})</td>
                                                    <td className="p-4 text-xs text-gray-500">{t.description || 'Other Transaction'}</td>
                                                    <td className={`p-4 font-bold ${t.type === 'Addition' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {t.type === 'Addition' ? '+' : '-'}{number3(t.grams)}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Locked</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-[#b8860b] text-white">
                                                <td className="p-4 font-black" colSpan="2">TOTAL BUSINESS HOLDING</td>
                                                <td className="p-4 font-black text-xl" colSpan="2">
                                                    {(() => {
                                                        const adjStock = manualAdjustments.adjustedStockGrams !== undefined
                                                            ? Number(manualAdjustments.adjustedStockGrams)
                                                            : (cards.totalStockWeight || 0) * (Number(businessSettings.sriBillPercentage) / 100);
                                                        const cashConv = manualAdjustments.cashConvertedGrams !== undefined
                                                            ? Number(manualAdjustments.cashConvertedGrams)
                                                            : (Number(businessSettings.goldRate) > 0 ? (cards.cashBalance || 0) / Number(businessSettings.goldRate) : 0);
                                                        const debtRec = Number(manualAdjustments.debtReceivableGrams ?? debtReceivableTotal);
                                                        const debtPay = Number(manualAdjustments.debtPayableGrams ?? debtPayableTotal);
                                                        const chitColl = Number(manualAdjustments.chitCollectionGrams ?? chitFundsGrams);
                                                        const otherSum = summary?.otherTransactions?.reduce((acc, t) => {
                                                            return t.type === 'Addition' ? acc + Number(t.grams) : acc - Number(t.grams);
                                                        }, 0) || 0;
                                                        return number3(adjStock + cashConv + debtRec + otherSum - debtPay - chitColl);
                                                    })()} g
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="mt-8 space-y-4">
                                    <h3 className="text-md font-black text-gray-900 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                        Profit Section
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Customer Sales Profit</p>
                                            <p className="text-xl font-black text-gray-900">{number3(summary?.plusSummaryTotals?.totalProfit)} g</p>
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Expenses Total (₹)</p>
                                            <p className="text-xl font-black text-red-600">₹{Number(expensesTotal).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
                                            <p className="text-[10px] uppercase font-bold text-amber-700 mb-1">Gold Rate for Profit (₹/g)</p>
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm font-bold text-amber-600">₹</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={profitGoldRate}
                                                    onChange={(e) => setProfitGoldRate(e.target.value.replace(/[^0-9.]/g, ''))}
                                                    readOnly={isReadOnly}
                                                    className="w-full text-xl font-black text-gray-900 outline-none focus:ring-1 focus:ring-amber-300 rounded bg-transparent"
                                                    placeholder="e.g. 6500"
                                                />
                                            </div>
                                            <p className="text-[10px] text-amber-500 mt-1">Expenses ÷ this rate = grams</p>
                                        </div>
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm">
                                            <p className="text-[10px] uppercase font-bold text-indigo-600 mb-1">Profit Balance (Grams)</p>
                                            <p className="text-xl font-black text-indigo-700">
                                                {(() => {
                                                    const totalProfit = Number(summary?.plusSummaryTotals?.totalProfit || 0);
                                                    const expenses = Number(expensesTotal || 0);
                                                    const rate = Number(profitGoldRate || 0);
                                                    const balance = rate > 0 ? (totalProfit - (expenses / rate)) : totalProfit;
                                                    return number3(balance);
                                                })()} g
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="bg-white border border-gray-200 rounded-2xl p-5 mt-6">
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button
                                onClick={handleDownloadPdf}
                                disabled={exporting}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm"
                            >
                                {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                                {exporting ? 'Generating...' : 'Download PDF'}
                            </button>
                            <button
                                onClick={handleWhatsAppShare}
                                disabled={exporting}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm"
                            >
                                <Share2 size={16} />
                                WhatsApp
                            </button>
                            <button
                                onClick={handleShare}
                                disabled={exporting}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white font-bold text-sm"
                            >
                                <Share2 size={16} />
                                Share
                            </button>
                        </div>
                    </section>


                </div>
            )}

            {/* Hidden Printable Container - PURE INLINE STYLES, NO TAILWIND CLASSES TO AVOID OKLCH ERROR */}
            <div style={{ position: 'fixed', top: 0, left: '-20000px', width: '800px', zIndex: -1, pointerEvents: 'none' }}>
                <div ref={printRef} id="pdf-report-content" style={{ opacity: 1, backgroundColor: '#ffffff', color: '#111827', padding: '60px', fontFamily: 'sans-serif' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px', paddingBottom: '20px', borderBottom: '2px solid #111827' }}>
                        <h1 style={{ fontSize: '30px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: '1', color: '#111827', margin: 0 }}>Sri Vaishnavi Jewellers</h1>
                        <p style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px', margin: '4px 0' }}>Monthly Billing Summary - {selectedMonth}</p>
                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', margin: '4px 0' }}>Generated on: {now.toLocaleString()}</p>
                    </div>

                    {/* Main Stats Area - Using Floats instead of Grid for PDF reliability */}
                    <div style={{ marginBottom: '40px', overflow: 'hidden', display: 'block' }}>
                        <div style={{ float: 'left', width: '48%', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '16px', boxSizing: 'border-box' }}>
                            <p style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', color: '#6b7280', margin: 0 }}>Total Stock Weight</p>
                            <p style={{ fontSize: '24px', fontWeight: '900', margin: '4px 0 0 0' }}>{number3(cards.totalStockWeight)} g</p>
                        </div>
                        <div style={{ float: 'right', width: '48%', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '16px', boxSizing: 'border-box' }}>
                            <p style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', color: '#6b7280', margin: 0 }}>Monthly Sales Bills</p>
                            <p style={{ fontSize: '24px', fontWeight: '900', margin: '4px 0 0 0' }}>{cards.monthlySalesBills}</p>
                        </div>
                        <div style={{ clear: 'both' }}></div>
                        <div style={{ float: 'left', width: '48%', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', boxSizing: 'border-box' }}>
                            <p style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', color: '#6b7280', margin: 0 }}>Cash Balance</p>
                            <p style={{ fontSize: '24px', fontWeight: '900', margin: '4px 0 0 0' }}>₹{Number(cards.cashBalance).toLocaleString('en-IN')}</p>
                        </div>
                        <div style={{ float: 'right', width: '48%', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', boxSizing: 'border-box' }}>
                            <p style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', color: '#6b7280', margin: 0 }}>Expenses Total</p>
                            <p style={{ fontSize: '24px', fontWeight: '900', color: '#dc2626', margin: '4px 0 0 0' }}>₹{Number(expensesTotal).toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    <div style={{ clear: 'both', height: '0px' }}></div>

                    <div style={{ display: 'block' }}>
                        {/* Define helper styles for tabular format */}
                        {(() => {
                            const thStyle = { padding: '8px', border: '1px solid #111827', backgroundColor: '#f3f4f6', fontWeight: 'bold', textAlign: 'center' };
                            const tdStyle = { padding: '8px', border: '1px solid #111827', textAlign: 'center' };
                            const tableStyle = { width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '32px' };

                            return (
                                <>
                                    <section style={{ display: 'block', marginBottom: '50px', clear: 'both' }}>
                                        <h2 style={{ display: 'block', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '8px', marginBottom: '16px' }}>1. Customer Sales</h2>
                                        <table style={{ ...tableStyle, fontSize: '10px' }}>
                                            <thead>
                                                <tr>
                                                    <th style={thStyle}>Customer</th>
                                                    <th style={thStyle}>Phone</th>
                                                    <th style={thStyle}>Date</th>
                                                    <th style={thStyle}>Time</th>
                                                    <th style={thStyle}>Bill No</th>
                                                    <th style={thStyle}>Item</th>
                                                    <th style={thStyle}>Weight</th>
                                                    <th style={thStyle}>Sri Cost</th>
                                                    <th style={thStyle}>Sri Bill</th>
                                                    <th style={thStyle}>Sri Plus</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {customerSales.map((s, i) => (
                                                    <tr key={i}>
                                                        <td style={tdStyle}>{s.customerName}</td>
                                                        <td style={tdStyle}>{s.phoneNumber}</td>
                                                        <td style={tdStyle}>{formatDate(s.date)}</td>
                                                        <td style={tdStyle}>{s.time}</td>
                                                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{s.billNumber}</td>
                                                        <td style={tdStyle}>{s.itemName}</td>
                                                        <td style={tdStyle}>{number3(s.weight)}g</td>
                                                        <td style={tdStyle}>₹{Number(s.sriCost).toLocaleString('en-IN')}</td>
                                                        <td style={tdStyle}>{number3(s.sriBill)}%</td>
                                                        <td style={{ ...tdStyle, fontWeight: 'bold' }}>{number3(s.plus)}g</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </section>

                                    <section style={{ display: 'block', marginBottom: '50px', clear: 'both' }}>
                                        <h2 style={{ display: 'block', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '8px', marginBottom: '16px' }}>2. Plus Summary</h2>
                                        <table style={tableStyle}>
                                            <thead>
                                                <tr>
                                                    <th style={thStyle}>Plus %</th>
                                                    <th style={thStyle}>Total Weight</th>
                                                    <th style={thStyle}>Profit (g)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {plusSummary.map((p, i) => (
                                                    <tr key={i}>
                                                        <td style={tdStyle}>{p.plus}%</td>
                                                        <td style={tdStyle}>{number3(p.totalWeight)}g</td>
                                                        <td style={tdStyle}>{number3(p.profit)}g</td>
                                                    </tr>
                                                ))}
                                                <tr style={{ fontWeight: 'bold' }}>
                                                    <td style={tdStyle}>TOTAL</td>
                                                    <td style={tdStyle}>{number3(plusTotals.totalWeight)}g</td>
                                                    <td style={tdStyle}>{number3(plusTotals.totalProfit)}g</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>

                                    <section style={{ display: 'block', marginBottom: '50px', clear: 'both' }}>
                                        <h2 style={{ display: 'block', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '8px', marginBottom: '16px' }}>3. Debt Receivable</h2>
                                        <table style={tableStyle}>
                                            <thead>
                                                <tr>
                                                    <th style={thStyle}>Name</th>
                                                    <th style={thStyle}>Phone</th>
                                                    <th style={thStyle}>Grams</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {debtReceivable.map((d, i) => (
                                                    <tr key={i}>
                                                        <td style={tdStyle}>{d.name}</td>
                                                        <td style={tdStyle}>{d.phoneNumber}</td>
                                                        <td style={tdStyle}>{number3(d.amount)}g</td>
                                                    </tr>
                                                ))}
                                                <tr style={{ fontWeight: 'bold' }}>
                                                    <td colSpan="2" style={tdStyle}>TOTAL</td>
                                                    <td style={tdStyle}>{number3(debtReceivableTotal)}g</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>

                                    <section style={{ display: 'block', marginBottom: '50px', clear: 'both' }}>
                                        <h2 style={{ display: 'block', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '8px', marginBottom: '16px' }}>4. Debt Payable</h2>
                                        <table style={tableStyle}>
                                            <thead>
                                                <tr>
                                                    <th style={thStyle}>Name</th>
                                                    <th style={thStyle}>Phone</th>
                                                    <th style={thStyle}>Grams</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {debtPayable.map((d, i) => (
                                                    <tr key={i}>
                                                        <td style={tdStyle}>{d.name}</td>
                                                        <td style={tdStyle}>{d.phoneNumber}</td>
                                                        <td style={tdStyle}>{number3(d.amount)}g</td>
                                                    </tr>
                                                ))}
                                                <tr style={{ fontWeight: 'bold' }}>
                                                    <td colSpan="2" style={tdStyle}>TOTAL</td>
                                                    <td style={tdStyle}>{number3(debtPayableTotal)}g</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>

                                    <section style={{ display: 'block', marginBottom: '50px', clear: 'both' }}>
                                        <h2 style={{ display: 'block', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '8px', marginBottom: '16px' }}>5. Expenses</h2>
                                        <table style={tableStyle}>
                                            <thead>
                                                <tr>
                                                    <th style={thStyle}>Date</th>
                                                    <th style={thStyle}>Name</th>
                                                    <th style={thStyle}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {expenses.map((e, i) => (
                                                    <tr key={i}>
                                                        <td style={tdStyle}>{formatDate(e.expenseDate)}</td>
                                                        <td style={tdStyle}>{e.expenseName}</td>
                                                        <td style={tdStyle}>₹{Number(e.amount).toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}
                                                <tr style={{ fontWeight: 'bold' }}>
                                                    <td colSpan="2" style={tdStyle}>TOTAL</td>
                                                    <td style={tdStyle}>₹{expensesTotal.toLocaleString('en-IN')}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>

                                    <section style={{ display: 'block', marginBottom: '50px', clear: 'both' }}>
                                        <h2 style={{ display: 'block', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '8px', marginBottom: '16px' }}>6. Chit Funds</h2>
                                        <table style={tableStyle}>
                                            <thead>
                                                <tr>
                                                    <th style={thStyle}>Date</th>
                                                    <th style={thStyle}>Amount</th>
                                                    <th style={thStyle}>Grams</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {chitFunds.map((c, i) => (
                                                    <tr key={i}>
                                                        <td style={tdStyle}>{formatDate(c.date)}</td>
                                                        <td style={tdStyle}>₹{Number(c.amount).toLocaleString('en-IN')}</td>
                                                        <td style={tdStyle}>{number3(c.gramsPurchased)}g</td>
                                                    </tr>
                                                ))}
                                                <tr style={{ fontWeight: 'bold' }}>
                                                    <td style={tdStyle}>TOTAL</td>
                                                    <td style={tdStyle}>₹{chitFundsTotal.toLocaleString('en-IN')}</td>
                                                    <td style={tdStyle}>{number3(chitFundsGrams)}g</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>

                                    <section style={{ display: 'block', marginBottom: '50px', clear: 'both' }}>
                                        <h2 style={{ display: 'block', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '8px', marginBottom: '16px' }}>7. Others</h2>
                                        <table style={tableStyle}>
                                            <thead>
                                                <tr>
                                                    <th style={thStyle}>Date</th>
                                                    <th style={thStyle}>Name</th>
                                                    <th style={thStyle}>Description</th>
                                                    <th style={thStyle}>Grams</th>
                                                    <th style={thStyle}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {otherTransactions.map((o, i) => (
                                                    <tr key={i}>
                                                        <td style={tdStyle}>{formatDate(o.date)}</td>
                                                        <td style={tdStyle}>{o.name}</td>
                                                        <td style={tdStyle}>{o.description || '-'}</td>
                                                        <td style={tdStyle}>{number3(o.grams)}g</td>
                                                        <td style={tdStyle}>₹{Number(o.amount).toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </section>

                                    <section style={{ display: 'block', marginBottom: '50px', clear: 'both' }}>
                                        <h2 style={{ display: 'block', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '8px', marginBottom: '16px' }}>8. Business Calculation Summary</h2>
                                        <table style={tableStyle}>
                                            <thead>
                                                <tr>
                                                    <th style={thStyle}>Component</th>
                                                    <th style={thStyle}>Description</th>
                                                    <th style={thStyle}>Grams</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td style={tdStyle}>Adjusted Stock (+)</td>
                                                    <td style={tdStyle}>{manualDescriptions.adjustedStock ?? `Total Stock weight (${number3(cards.totalStockWeight)}g) * SRI Bill % (${businessSettings.sriBillPercentage}%)`}</td>
                                                    <td style={{ ...tdStyle, fontWeight: 'bold', color: '#059669' }}>{number3(manualAdjustments.adjustedStockGrams ?? (businessSummary?.adjustedStockGrams || 0))}g</td>
                                                </tr>
                                                <tr>
                                                    <td style={tdStyle}>Cash converted (+)</td>
                                                    <td style={tdStyle}>{manualDescriptions.cashConverted ?? `Cash Balance (₹${Number(cards.cashBalance).toLocaleString()}) / Gold Rate (₹${businessSettings.goldRate})`}</td>
                                                    <td style={{ ...tdStyle, fontWeight: 'bold', color: '#059669' }}>{number3(manualAdjustments.cashConvertedGrams ?? (businessSummary?.cashConvertedGrams || 0))}g</td>
                                                </tr>
                                                <tr>
                                                    <td style={tdStyle}>Debt Receivable (+)</td>
                                                    <td style={tdStyle}>{manualDescriptions.debtReceivable ?? 'Total amount to be received in grams'}</td>
                                                    <td style={{ ...tdStyle, fontWeight: 'bold', color: '#059669' }}>{number3(manualAdjustments.debtReceivableGrams ?? debtReceivableTotal)}g</td>
                                                </tr>
                                                <tr>
                                                    <td style={tdStyle}>Debt Payable (-)</td>
                                                    <td style={tdStyle}>{manualDescriptions.debtPayable ?? 'Total amount to be paid in grams'}</td>
                                                    <td style={{ ...tdStyle, fontWeight: 'bold', color: '#dc2626' }}>{number3(manualAdjustments.debtPayableGrams ?? debtPayableTotal)}g</td>
                                                </tr>
                                                <tr>
                                                    <td style={tdStyle}>Chit collection (-)</td>
                                                    <td style={tdStyle}>{manualDescriptions.chitCollection ?? 'Total grams purchased via chit funds'}</td>
                                                    <td style={{ ...tdStyle, fontWeight: 'bold', color: '#dc2626' }}>{number3(manualAdjustments.chitCollectionGrams ?? chitFundsGrams)}g</td>
                                                </tr>
                                                {summary?.otherTransactions?.map((t, idx) => (
                                                    <tr key={idx}>
                                                        <td style={tdStyle}>{t.name} ({t.type === 'Addition' ? '+' : '-'})</td>
                                                        <td style={tdStyle}>{t.description || 'Other Transaction'}</td>
                                                        <td style={{ ...tdStyle, fontWeight: 'bold', color: t.type === 'Addition' ? '#059669' : '#dc2626' }}>{t.type === 'Addition' ? '+' : '-'}{number3(t.grams)}g</td>
                                                    </tr>
                                                ))}
                                                <tr style={{ backgroundColor: '#b8860b', color: '#ffffff', fontWeight: '900' }}>
                                                    <td colSpan="2" style={{ padding: '12px', border: '1px solid #111827', textAlign: 'right' }}>TOTAL BUSINESS HOLDING</td>
                                                    <td style={{ padding: '12px', border: '1px solid #111827', textAlign: 'center', fontSize: '14px' }}>
                                                        {(() => {
                                                            const adjStock = Number(manualAdjustments.adjustedStockGrams ?? (businessSummary?.adjustedStockGrams || 0));
                                                            const cashConv = Number(manualAdjustments.cashConvertedGrams ?? (businessSummary?.cashConvertedGrams || 0));
                                                            const debtRec = Number(manualAdjustments.debtReceivableGrams ?? debtReceivableTotal);
                                                            const debtPay = Number(manualAdjustments.debtPayableGrams ?? debtPayableTotal);
                                                            const chitColl = Number(manualAdjustments.chitCollectionGrams ?? chitFundsGrams);
                                                            const otherSum = summary?.otherTransactions?.reduce((acc, t) => {
                                                                return t.type === 'Addition' ? acc + Number(t.grams) : acc - Number(t.grams);
                                                            }, 0) || 0;
                                                            return number3(adjStock + cashConv + debtRec + otherSum - debtPay - chitColl);
                                                        })()} g
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>

                                    <section style={{ display: 'block', marginBottom: '50px', clear: 'both' }}>
                                        <h2 style={{ display: 'block', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '8px', marginBottom: '16px' }}>9. Profit Section</h2>
                                        <div style={{ overflow: 'hidden' }}>
                                            <div style={{ float: 'left', width: '23%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', marginRight: '2%', boxSizing: 'border-box' }}>
                                                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#6b7280', margin: 0 }}>SALES PROFIT</p>
                                                <p style={{ fontSize: '16px', fontWeight: '900', margin: '4px 0' }}>{number3(summary?.plusSummaryTotals?.totalProfit)} g</p>
                                            </div>
                                            <div style={{ float: 'left', width: '23%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', marginRight: '2%', boxSizing: 'border-box' }}>
                                                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#6b7280', margin: 0 }}>EXPENSES (₹)</p>
                                                <p style={{ fontSize: '16px', fontWeight: '900', color: '#dc2626', margin: '4px 0' }}>₹{Number(expensesTotal).toLocaleString()}</p>
                                            </div>
                                            <div style={{ float: 'left', width: '23%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', marginRight: '2%', boxSizing: 'border-box' }}>
                                                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#6b7280', margin: 0 }}>PROFIT GOLD RATE</p>
                                                <p style={{ fontSize: '16px', fontWeight: '900', margin: '4px 0' }}>₹{profitGoldRate}/g</p>
                                            </div>
                                            <div style={{ float: 'left', width: '23%', padding: '12px', backgroundColor: '#eef2ff', border: '1px solid #e0e7ff', borderRadius: '8px', boxSizing: 'border-box' }}>
                                                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#4f46e5', margin: 0 }}>NET PROFIT</p>
                                                <p style={{ fontSize: '16px', fontWeight: '900', color: '#4338ca', margin: '4px 0' }}>
                                                    {(() => {
                                                        const totalProfit = Number(summary?.plusSummaryTotals?.totalProfit || 0);
                                                        const expenses = Number(expensesTotal || 0);
                                                        const rate = Number(profitGoldRate || 0);
                                                        const balance = rate > 0 ? (totalProfit - (expenses / rate)) : totalProfit;
                                                        return number3(balance);
                                                    })()} g
                                                </p>
                                            </div>
                                        </div>
                                    </section>
                                </>
                            );
                        })()}
                    </div>

                    <div style={{ marginTop: '80px', paddingTop: '40px', textAlign: 'center', borderTop: '1px solid #e5e7eb', clear: 'both' }}>
                        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>© {new Date().getFullYear()} Sri Vaishnavi Jewellers. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default MonthlyBillingSummary;
