import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Download, Loader2, Save, Share2, Trash2, Plus } from 'lucide-react';
import api from '../axiosConfig';

const number3 = (value) => Number(value || 0).toFixed(3);
const BillingSummary = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [now, setNow] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [infoMessage, setInfoMessage] = useState('');

    const [summary, setSummary] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [expensesTotal, setExpensesTotal] = useState(0);

    const [cashInput, setCashInput] = useState('0');
    const [savingCash, setSavingCash] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [chitFundSummary, setChitFundSummary] = useState({ totalAmount: 0, totalGrams: 0 });
    const [chitFundRows, setChitFundRows] = useState([]);
    const [otherTransactions, setOtherTransactions] = useState([]);
    const [newOther, setNewOther] = useState({ name: '', description: '', type: 'Addition', grams: '', amount: '' });
    const [addingOther, setAddingOther] = useState(false);



    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [selectedDate]);

    const fetchAllData = async () => {
        setLoading(true);
        setErrorMessage('');
        setInfoMessage('');
        try {
            const { data: res } = await api.get('/billing/summary', { params: { date: selectedDate } });
            const summaryData = res.data;

            setSummary(summaryData);
            setExpenses(summaryData?.expenses || []);
            setExpensesTotal(Number(summaryData?.expensesTotal || 0));
            setCashInput(String(summaryData?.cards?.cashBalance ?? 0));

            setChitFundSummary({
                totalAmount: Number(summaryData?.chitFundsTotal || 0),
                totalGrams: Number(summaryData?.chitFundsGrams || 0)
            });
            setChitFundRows(summaryData?.chitFunds || []);
            setOtherTransactions(summaryData?.otherTransactions || []);
        } catch (error) {
            console.error('Error fetching billing summary:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to load billing summary');
        } finally {
            setLoading(false);
        }
    };

    const saveCashBalance = async () => {
        setSavingCash(true);
        setErrorMessage('');
        setInfoMessage('');
        try {
            const amount = Number(cashInput);
            await api.put('/billing/cash-balance', { amount });
            await fetchAllData();
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
    const cards = summary?.cards || {
        totalStockItems: 0,
        totalStockWeight: 0,
        dailySalesBills: 0,
        cashBalance: 0
    };

    const debtReceivableTotal = useMemo(() => debtReceivable.reduce((acc, r) => acc + Number(r.amount || 0), 0), [debtReceivable]);
    const debtPayableTotal = useMemo(() => debtPayable.reduce((acc, r) => acc + Number(r.amount || 0), 0), [debtPayable]);



    const expenseComputedTotal = useMemo(
        () => Number((expensesTotal || expenses.reduce((acc, row) => acc + Number(row.amount || 0), 0)).toFixed(3)),
        [expenses, expensesTotal]
    );

    const buildShareText = () => {
        const textLines = [
            `Billing Summary (${selectedDate})`,
            `Total Stock Items: ${cards.totalStockItems}`,
            `Total Stock Weight (g): ${number3(cards.totalStockWeight)}`,
            `Daily Sales (Bills): ${cards.dailySalesBills}`,
            `Cash Balance: ${number3(cards.cashBalance)}`,
            `Debt Payable Count: ${debtPayable.length}`,
            `Debt Receivable Count: ${debtReceivable.length}`,
            `Daily Expenses Total: ${number3(expenseComputedTotal)}`
        ];
        return textLines.join('\n');
    };

    const handleDownloadPdf = async () => {
        setExporting(true);
        setErrorMessage('');
        setInfoMessage('');
        try {
            const response = await api.get('/reports/daily/pdf', {
                params: { date: selectedDate },
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
                    // ignore json parse failure
                }
                throw new Error(message);
            }
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `billing-summary-${selectedDate}.pdf`;
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
            // First, get the PDF as a blob (same as download)
            const response = await api.get('/reports/daily/pdf', {
                params: { date: selectedDate },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const file = new File([blob], `billing-summary-${selectedDate}.pdf`, { type: 'application/pdf' });

            // Check if Web Share API supports file sharing
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Daily Billing Summary - ${selectedDate}`,
                    text: `Please find the Daily Billing Summary for ${selectedDate} attached.`
                });
                setInfoMessage('PDF shared successfully.');
            } else {
                // Fallback to the old link-based WhatsApp sharing if direct file sharing isn't supported
                window.alert('Direct file sharing is not supported on this browser. Opening WhatsApp with a download link instead.');
                const phoneInput = window.prompt('Recipient WhatsApp number (with country code, e.g., 919876543210):');
                const phone = phoneInput ? phoneInput.replace(/\D/g, '') : '';

                const { data } = await api.get('/reports/daily/pdf/share-link', {
                    params: { date: selectedDate, phone }
                });
                const fileUrl = data?.data?.fileUrl;
                const whatsappUrl = data?.data?.whatsappUrl;

                if (fileUrl) {
                    const shareText = `Daily Billing Summary (${selectedDate}) PDF:\n${fileUrl}`;
                    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
                    const mobileUrl = phone
                        ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(shareText)}`
                        : `whatsapp://send?text=${encodeURIComponent(shareText)}`;

                    if (isMobile) {
                        window.location.href = mobileUrl;
                    } else if (whatsappUrl) {
                        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                    }
                }
            }
        } catch (error) {
            console.error('WhatsApp share failed:', error);
            setErrorMessage(error.response?.data?.message || error.message || 'Unable to share via WhatsApp');
        } finally {
            setExporting(false);
        }
    };

    const handleShare = async () => {
        setExporting(true);
        try {
            const response = await api.get('/reports/daily/pdf', {
                params: { date: selectedDate },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const file = new File([blob], `billing-summary-${selectedDate}.pdf`, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Daily Billing Summary',
                    text: `Daily Summary for ${selectedDate}`
                });
            } else {
                // Fallback to text share
                const shareText = buildShareText();
                await navigator.share({
                    title: 'Daily Billing Summary',
                    text: shareText,
                    url: window.location.href
                });
            }
        } catch (error) {
            console.error('Share failed:', error);
            // Final fallback to clipboard
            const shareText = buildShareText();
            await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
            setInfoMessage('Summary copied to clipboard (file sharing not supported).');
        } finally {
            setExporting(false);
        }
    };

    const handleAddOther = async (e) => {
        e.preventDefault();
        setAddingOther(true);
        try {
            await api.post('/billing/other-transactions', {
                ...newOther,
                date: selectedDate,
                grams: Number(newOther.grams) || 0,
                amount: Number(newOther.amount) || 0
            });
            setNewOther({ name: '', description: '', type: 'Addition', grams: '', amount: '' });
            setInfoMessage('Other transaction added successfully');
            await fetchAllData();
        } catch (error) {
            console.error('Error adding other transaction:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to add other transaction');
        } finally {
            setAddingOther(false);
        }
    };

    const handleDeleteOther = async (id) => {
        if (!window.confirm('Delete this transaction?')) return;
        try {
            await api.delete(`/billing/other-transactions/${id}`);
            setInfoMessage('Transaction deleted');
            await fetchAllData();
        } catch (error) {
            console.error('Error deleting other transaction:', error);
            setErrorMessage('Failed to delete transaction');
        }
    };

    return (
        <div className="p-6 md:p-8 bg-[#f7f7f5] min-h-screen">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900">Daily Summary</h1>
                    <p className="text-sm text-gray-500 mt-1">Daily accounting dashboard</p>
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
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent outline-none text-sm font-bold text-gray-800"
                        />
                    </div>
                </div>
            </div>

            {errorMessage && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {errorMessage}
                </div>
            )}
            {infoMessage && (
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                    {infoMessage}
                </div>
            )}

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
                    <div className="text-xs text-gray-500 uppercase font-black tracking-widest mb-1">Daily Sales (Bills)</div>
                    <div className="text-3xl font-black text-gray-900">{cards.dailySalesBills}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <div className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2">Current Amount in the Business</div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={cashInput}
                            onChange={(e) => setCashInput(e.target.value.replace(/[^0-9.]/g, ''))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#b8860b33]"
                        />
                        <button
                            onClick={saveCashBalance}
                            disabled={savingCash}
                            className="px-3 py-2 rounded-lg bg-[#b8860b] text-white font-bold disabled:opacity-60"
                        >
                            <Save size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="py-16 flex items-center justify-center text-gray-500 font-bold gap-2">
                    <Loader2 className="animate-spin" size={20} /> Loading billing data...
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
                                    <tr><td colSpan="10" className="py-8 text-center text-gray-400 font-semibold">No customer sales for selected date.</td></tr>
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
                                    <tr><td colSpan="3" className="py-8 text-center text-gray-400 font-semibold">No plus summary for selected date.</td></tr>
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
                            </table>
                        </div>
                    </section>

                    <section className="bg-white border border-gray-200 rounded-2xl p-5 overflow-x-auto">
                        <h2 className="text-lg font-black text-gray-900 mb-4">5. Daily Expenses (From Expense Management)</h2>

                        <table className="w-full min-w-[600px] text-sm">
                            <thead className="text-left text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                                <tr>
                                    <th className="py-3 pr-3">Expense Name</th>
                                    <th className="py-3 pr-3">Type</th>
                                    <th className="py-3 pr-3">Time</th>
                                    <th className="py-3 pr-3">Amount</th>
                                    <th className="py-3 pr-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {expenses.length === 0 ? (
                                    <tr><td colSpan="5" className="py-8 text-center text-gray-400 font-semibold">No daily expenses for selected date.</td></tr>
                                ) : expenses.map((row) => (
                                    <tr key={row._id}>
                                        <td className="py-3 pr-3 font-semibold text-gray-800">{row.expenseName}</td>
                                        <td className="py-3 pr-3 text-gray-700">{row.expenseType}</td>
                                        <td className="py-3 pr-3 text-gray-700">{row.expenseTime || '-'}</td>
                                        <td className="py-3 pr-3 text-gray-700">{number3(row.amount)}</td>
                                        <td className="py-3 pr-3 text-gray-700">{row.notes || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-300">
                                    <td colSpan="3" className="py-3 pr-3 font-black text-gray-900">TOTAL</td>
                                    <td className="py-3 pr-3 font-black text-gray-900">{number3(expenseComputedTotal)}</td>
                                    <td />
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
                                    {Number(chitFundSummary.totalGrams).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                    <span className="text-sm font-semibold text-gray-500 ml-1">gms</span>
                                </p>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 min-w-[180px]">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Total Cash Collected</p>
                                <p className="text-2xl font-black text-gray-900 mt-0.5">
                                    ₹{Number(chitFundSummary.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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
                                {chitFundRows.length === 0 ? (
                                    <tr><td colSpan="3" className="py-8 text-center text-gray-400 font-semibold">No chit funds for selected date.</td></tr>
                                ) : chitFundRows.map((row) => (
                                    <tr key={row._id}>
                                        <td className="py-3 pr-3 text-gray-700">{row.date ? new Date(row.date).toISOString().slice(0, 10) : '-'}</td>
                                        <td className="py-3 pr-3 font-semibold text-gray-900">{number3(row.amount)}</td>
                                        <td className="py-3 pr-3 font-extrabold text-yellow-700">{number3(row.gramsPurchased)} gms</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-300">
                                    <td className="py-3 pr-3 font-black text-gray-900">TOTAL</td>
                                    <td className="py-3 pr-3 font-black text-gray-900">{number3(chitFundSummary.totalAmount)}</td>
                                    <td className="py-3 pr-3 font-black text-yellow-700">{number3(chitFundSummary.totalGrams)} gms</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>

                    <section className="bg-white border border-gray-200 rounded-2xl p-5 overflow-x-auto">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-indigo-600 text-white rounded-lg">
                                <Plus size={20} />
                            </div>
                            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">7. Other Section</h2>
                        </div>

                        <form onSubmit={handleAddOther} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <input
                                type="text" placeholder="Name" required
                                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={newOther.name} onChange={e => setNewOther({ ...newOther, name: e.target.value })}
                            />
                            <input
                                type="text" placeholder="Description"
                                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={newOther.description} onChange={e => setNewOther({ ...newOther, description: e.target.value })}
                            />
                            <select
                                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={newOther.type} onChange={e => setNewOther({ ...newOther, type: e.target.value })}
                            >
                                <option value="Addition">Addition (+)</option>
                                <option value="Subtraction">Subtraction (-)</option>
                            </select>
                            <input
                                type="number" step="0.001" placeholder="Grams" required
                                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={newOther.grams} onChange={e => setNewOther({ ...newOther, grams: e.target.value })}
                            />
                            <input
                                type="number" step="0.01" placeholder="Amount (optional)"
                                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={newOther.amount} onChange={e => setNewOther({ ...newOther, amount: e.target.value })}
                            />
                            <button
                                type="submit" disabled={addingOther}
                                className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {addingOther ? 'Adding...' : 'Add Transaction'}
                            </button>
                        </form>

                        <table className="w-full text-sm">
                            <thead className="text-left text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200 text-center">
                                <tr>
                                    <th className="py-3 px-3">Name</th>
                                    <th className="py-3 px-3">Description</th>
                                    <th className="py-3 px-3">Type</th>
                                    <th className="py-3 px-3">Grams</th>
                                    <th className="py-3 px-3">Amount</th>
                                    <th className="py-3 px-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {otherTransactions.length === 0 ? (
                                    <tr><td colSpan="6" className="py-8 text-center text-gray-400 font-semibold">No other transactions for this date.</td></tr>
                                ) : otherTransactions.map(t => (
                                    <tr key={t._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-4 px-3 font-bold text-gray-900">{t.name}</td>
                                        <td className="py-4 px-3 text-gray-500 text-xs">{t.description || '-'}</td>
                                        <td className="py-4 px-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${t.type === 'Addition' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
                                                }`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className={`py-4 px-3 text-center font-black ${t.type === 'Addition' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {t.type === 'Addition' ? '+' : '-'}{number3(t.grams)} g
                                        </td>
                                        <td className="py-4 px-3 text-center text-gray-600">₹{Number(t.amount || 0).toLocaleString('en-IN')}</td>
                                        <td className="py-4 px-3 text-right">
                                            <button
                                                onClick={() => handleDeleteOther(t._id)}
                                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>                    <section className="bg-white border border-gray-200 rounded-2xl p-5">
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button
                                onClick={handleDownloadPdf}
                                disabled={exporting}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm"
                            >
                                <Download size={16} />
                                {exporting ? 'Preparing...' : 'Download PDF'}
                            </button>
                            <button
                                onClick={handleWhatsAppShare}
                                disabled={exporting}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm disabled:opacity-60"
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
                    </section>                </div>
            )}
        </div>
    );
};

export default BillingSummary;
