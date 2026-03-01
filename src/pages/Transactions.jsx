
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Filter,
    Download,
    MoreVertical,
    Eye,
    ArrowRight,
    Clock,
    User,
    Phone,
    Hash,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Loader2,
    X,
    FileText,
    ArrowUpRight,
    ArrowDownLeft,
    Plus,
    Trash2,
    Pencil
} from 'lucide-react';
import api from '../axiosConfig';
import { format } from 'date-fns';
import { useDevice } from '../context/DeviceContext';

const Transactions = () => {
    const { isReadOnly, isMobile } = useDevice();
    const [transactions, setTransactions] = useState([]);
    const [dealerTransactions, setDealerTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dealerLoading, setDealerLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [saleType, setSaleType] = useState('All');
    const [dateRange, setDateRange] = useState('Last 30 Days');
    const [dealerPage, setDealerPage] = useState(1);
    const [dealerTotalPages, setDealerTotalPages] = useState(1);
    const [lineStockTxns, setLineStockTxns] = useState([]);
    const [lineStockLoading, setLineStockLoading] = useState(true);
    const [lineStockPage, setLineStockPage] = useState(1);
    const [lineStockTotalPages, setLineStockTotalPages] = useState(1);
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTransactions();
        fetchDealerTransactions();
        fetchLineStockTransactions();
    }, [saleType, dateRange, dealerPage, lineStockPage]);

    const fetchTransactions = async (query = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (query) params.append('query', query);
            if (saleType !== 'All') params.append('saleType', saleType);

            // Date logic simplified for now
            if (dateRange !== 'All Time') {
                const now = new Date();
                let start = new Date();
                if (dateRange === 'Last 30 Days') start.setDate(now.getDate() - 30);
                if (dateRange === 'Today') start.setHours(0, 0, 0, 0);
                params.append('startDate', start.toISOString());
            }

            const { data } = await api.get(`/sales?${params.toString()}`);
            setTransactions(data.data);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDealerTransactions = async () => {
        setDealerLoading(true);
        try {
            const { data } = await api.get(`/dealers/transactions?type=Dealer&page=${dealerPage}&limit=10`);
            setDealerTransactions(data.data || []);
            setDealerTotalPages(data.totalPages || 1);
        } catch (error) {
            console.error('Error fetching dealer transactions:', error);
            setDealerTransactions([]);
        } finally {
            setDealerLoading(false);
        }
    };

    const fetchLineStockTransactions = async () => {
        setLineStockLoading(true);
        try {
            const { data } = await api.get(`/dealers/transactions?type=Line Stocker&page=${lineStockPage}&limit=10`);
            setLineStockTxns(data.data || []);
            setLineStockTotalPages(data.totalPages || 1);
        } catch (error) {
            console.error('Error fetching line stock transactions:', error);
            setLineStockTxns([]);
        } finally {
            setLineStockLoading(false);
        }
    };

    const handleSearch = (e) => {
        if (e.key === 'Enter') {
            fetchTransactions(search);
        }
    };

    const openDetails = (txn) => {
        setSelectedTxn(txn);
        setIsModalOpen(true);
    };

    const deleteSale = async (id) => {
        try {
            const { data } = await api.delete(`/sales/${id}`);
            if (data.success) {
                fetchTransactions();
            }
        } catch (error) {
            console.error('Error deleting sale:', error);
        }
    };

    const deleteDealerTxn = async (id, type) => {
        try {
            const { data } = await api.delete(`/dealers/transactions/${id}`);
            if (data.success) {
                if (type === 'Dealer') fetchDealerTransactions();
                else fetchLineStockTransactions();
            }
        } catch (error) {
            console.error('Error deleting dealer transaction:', error);
        }
    };

    const toCsvCell = (value) => {
        const str = String(value ?? '');
        return `"${str.replace(/"/g, '""')}"`;
    };
    const toExcelText = (value) => `'${String(value ?? '')}`;

    const exportToCSV = async () => {
        try {
            setExporting(true);

            // Fetch all records for export (ignoring current pagination)
            const [salesRes, dealersRes, lineStockRes] = await Promise.all([
                api.get('/sales?limit=5000'),
                api.get('/dealers/transactions?type=Dealer&limit=5000'),
                api.get('/dealers/transactions?type=Line Stocker&limit=5000')
            ]);

            const allSales = salesRes.data?.data || [];
            const allDealers = dealersRes.data?.data || [];
            const allLineStock = lineStockRes.data?.data || [];

            if (allSales.length === 0 && allDealers.length === 0 && allLineStock.length === 0) {
                setExporting(false);
                return;
            }

            const salesHeader = [
                'Serial No', 'Date', 'Time', 'Sale Type', 'Customer Name', 'Phone',
                'Issued Bill No', 'Issued Item No', 'Issued Item Name', 'Issued Weight', 'Current Count', 'Purchase Count', 'Issued Sri Bill',
                'Receipt Bill No', 'Receipt Serial', 'Receipt Type', 'Receipt Weight'
            ];

            const salesRows = allSales.flatMap((txn, txnIdx) => {
                const rowCount = Math.max(txn.issuedItems?.length || 0, txn.receiptItems?.length || 0, 1);
                return Array.from({ length: rowCount }).map((_, idx) => {
                    const issued = txn.issuedItems?.[idx] || {};
                    const receipt = txn.receiptItems?.[idx] || {};
                    return [
                        idx === 0 ? (txnIdx + 1) : '',
                        toExcelText(txn.date ? format(new Date(txn.date), 'dd/MM/yyyy') : '-'),
                        toExcelText(txn.time || '-'),
                        txn.saleType || '-',
                        txn.customerDetails?.name || '-',
                        toExcelText(txn.customerDetails?.phone || '-'),
                        issued.billNo || '-',
                        issued.serialNo || '-',
                        issued.itemName || '-',
                        issued.netWeight ?? issued.weight ?? '-',
                        issued.currentCount ?? '-',
                        issued.purchaseCount ?? '-',
                        Number(issued.sriBill || 0).toFixed(2),
                        receipt.billNo || '-',
                        receipt.serialNo || '-',
                        receipt.receiptType || '-',
                        receipt.weight ?? '-'
                    ];
                });
            });

            const salesTotals = allSales.reduce((acc, txn) => {
                acc.salesCount += 1;
                acc.issuedCount += Array.isArray(txn.issuedItems) ? txn.issuedItems.length : 0;
                acc.receiptCount += Array.isArray(txn.receiptItems) ? txn.receiptItems.length : 0;
                acc.issuedSriBill += (txn.issuedItems || []).reduce((sum, item) => sum + (Number(item.sriBill || 0) || 0), 0);
                acc.receiptWeight += (txn.receiptItems || []).reduce((sum, item) => sum + (Number(item.weight || 0) || 0), 0);
                return acc;
            }, { salesCount: 0, issuedCount: 0, receiptCount: 0, issuedSriBill: 0, receiptWeight: 0 });

            const dealerHeader = ['S.No', 'Name', 'Date', 'Time', 'Phone No', 'Amount'];
            const dealerRows = allDealers.map((txn, idx) => {
                const amount = Number(txn.balanceAfter ?? txn.amount ?? 0);
                return [
                    idx + 1,
                    txn.name || '-',
                    toExcelText(formatDateSafe(txn.date)),
                    toExcelText(txn.time || '-'),
                    toExcelText(txn.phoneNumber || '-'),
                    Math.abs(amount).toFixed(2)
                ];
            });
            const dealerTotalAmount = allDealers.reduce((sum, txn) => {
                const amount = Number(txn.balanceAfter ?? txn.amount ?? 0);
                return sum + Math.abs(amount);
            }, 0);

            const lineStockHeader = ['S.No', 'Name', 'Date', 'Time', 'Phone No', 'Balance After (g)'];
            const lineStockRows = allLineStock.map((txn, idx) => {
                const amount = Number(txn.balanceAfter ?? 0);
                return [
                    idx + 1,
                    txn.name || '-',
                    toExcelText(formatDateSafe(txn.date)),
                    toExcelText(txn.time || '-'),
                    toExcelText(txn.phoneNumber || '-'),
                    amount.toFixed(3)
                ];
            });
            const lineStockTotalTotal = allLineStock.reduce((sum, txn) => sum + Number(txn.balanceAfter ?? 0), 0);

            const csvLines = [];
            csvLines.push(toCsvCell('Sales Transaction History'));
            csvLines.push(salesHeader.map(toCsvCell).join(','));
            salesRows.forEach((row) => csvLines.push(row.map(toCsvCell).join(',')));
            csvLines.push(['TOTAL', '', '', '', '', '', '', '', '', '', salesTotals.issuedCount, salesTotals.receiptCount, salesTotals.issuedSriBill.toFixed(2), '', '', '', salesTotals.receiptWeight.toFixed(3)].map(toCsvCell).join(','));
            csvLines.push(['SUMMARY', 'Sales Count', salesTotals.salesCount, 'Issued Items', salesTotals.issuedCount, 'Receipt Items', salesTotals.receiptCount, 'Issued Sri Bill', salesTotals.issuedSriBill.toFixed(2), 'Receipt Weight', salesTotals.receiptWeight.toFixed(3)].map(toCsvCell).join(','));

            for (let i = 0; i < 5; i++) csvLines.push('');

            csvLines.push(toCsvCell('Dealer Transaction'));
            csvLines.push(dealerHeader.map(toCsvCell).join(','));
            dealerRows.forEach((row) => csvLines.push(row.map(toCsvCell).join(',')));
            csvLines.push(['TOTAL', '', '', '', '', dealerTotalAmount.toFixed(2)].map(toCsvCell).join(','));

            for (let i = 0; i < 5; i++) csvLines.push('');

            csvLines.push(toCsvCell('Line Stock Transaction'));
            csvLines.push(lineStockHeader.map(toCsvCell).join(','));
            lineStockRows.forEach((row) => csvLines.push(row.map(toCsvCell).join(',')));
            csvLines.push(['TOTAL', '', '', '', '', lineStockTotalTotal.toFixed(3)].map(toCsvCell).join(','));

            const csv = csvLines.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Transactions_${format(new Date(), 'dd-MM-yyyy')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
        }
    };

    const exportToPDF = async () => {
        try {
            setExportingPdf(true);
            const params = new URLSearchParams();
            if (saleType !== 'All') params.append('saleType', saleType);
            if (dateRange !== 'All Time') {
                const now = new Date();
                let start = new Date();
                if (dateRange === 'Last 30 Days') start.setDate(now.getDate() - 30);
                if (dateRange === 'Today') start.setHours(0, 0, 0, 0);
                params.append('startDate', start.toISOString());
            }

            const response = await api.get(`/reports/transactions/pdf?${params.toString()}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Transaction_History_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Failed to download PDF report');
        } finally {
            setExportingPdf(false);
        }
    };

    const formatDateSafe = (value) => {
        if (!value) return '-';
        const asDate = new Date(value);
        if (!Number.isNaN(asDate.getTime())) return format(asDate, 'dd/MM/yy');
        return value;
    };

    return (
        <div className="p-8 bg-gray-50/30 min-h-screen">
            <style>
                {`
                    .custom-scrollbar::-webkit-scrollbar {
                        height: 8px;
                        width: 8px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: #f1f1f1;
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: #e2e2e2;
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #cbd5e1;
                    }
                `}
            </style>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        Transaction History
                        <span className="bg-gray-200/50 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {transactions.length} Total
                        </span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {!isMobile && (
                        <button className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 hover:border-gray-900 transition-all shadow-sm">
                            <Clock size={20} />
                        </button>
                    )}
                    {!isReadOnly && (
                        <button onClick={() => navigate('/admin/sales')} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-yellow-400 text-gray-900 px-6 py-2.5 rounded-xl font-black text-sm hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-100">
                            <Plus size={18} /> New Sale
                        </button>
                    )}
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative w-full md:flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search ID, Name or Phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleSearch}
                        className="w-full bg-gray-50 border border-transparent pl-12 pr-4 py-3 rounded-xl font-bold text-sm focus:bg-white focus:border-gray-200 outline-none transition-all"
                    />
                </div>

                <div className="flex w-full md:w-auto gap-2">
                    <select
                        value={saleType}
                        onChange={(e) => setSaleType(e.target.value)}
                        className="flex-1 md:flex-none bg-white border border-gray-200 px-4 py-3 rounded-xl font-bold text-xs md:text-sm outline-none cursor-pointer hover:border-gray-300"
                    >
                        <option value="All">All Types</option>
                        <option value="B2B">B2B</option>
                        <option value="B2C">B2C</option>
                    </select>

                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="flex-1 md:flex-none bg-white border border-gray-200 px-4 py-3 rounded-xl font-bold text-xs md:text-sm outline-none cursor-pointer hover:border-gray-300"
                    >
                        <option value="Last 30 Days">Last 30 Days</option>
                        <option value="Today">Today</option>
                        <option value="All Time">All Time</option>
                    </select>
                </div>

                <div className="flex w-full md:w-auto gap-2">
                    <button
                        onClick={exportToCSV}
                        disabled={exporting}
                        className="flex-1 bg-white border border-gray-200 text-gray-600 px-4 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />} CSV
                    </button>
                    <button
                        onClick={exportToPDF}
                        disabled={exportingPdf}
                        className="flex-1 bg-gray-900 text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {exportingPdf ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />} PDF
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        {/* Grouped Headers */}
                        <tr className="bg-gray-900 border-b border-gray-800">
                            <th colSpan="5" className="px-6 py-3 text-[10px] font-black text-yellow-400 uppercase tracking-[0.2em] border-r border-gray-800 text-center">Customer Information</th>
                            <th colSpan="10" className="px-6 py-3 text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] border-r border-gray-800 text-center bg-emerald-900/20">Issued Items (Outbound)</th>
                            <th colSpan="8" className="px-6 py-3 text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] text-center bg-orange-900/20">Receipt Items (Inbound)</th>
                        </tr>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-gray-100 min-w-[60px]">Serial</th>
                            <th className="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-gray-100 min-w-[150px]">Customer Name</th>
                            <th className="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-gray-100 min-w-[120px]">Phone No</th>
                            <th className="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-gray-100 min-w-[100px]">Date</th>
                            <th className="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-gray-200 min-w-[80px]">Time</th>

                            {/* Issued */}
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-emerald-50/30 w-[100px]">Bill No</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-emerald-50/30 w-[80px]">Item No</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-emerald-50/30 w-[120px]">Item Name</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-emerald-50/30 border-l border-emerald-100 w-[80px]">Weight (G)</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-emerald-50/30 w-[60px]">Curr</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-emerald-50/30 w-[60px]">Purc</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-emerald-50/30 w-[80px]">Purity</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-emerald-50/30 w-[100px]">Sri Cost</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-emerald-50/30 font-bold text-emerald-700 w-[100px]">Sri Bill</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-emerald-50/30 border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] w-[60px]">Plus (%)</th>

                            {/* Receipt */}
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-orange-50/30 w-[100px]">Bill No</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-orange-50/30 w-[100px]">Serial No</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-orange-50/30 w-[120px]">Receipt Type</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-orange-50/30 w-[80px]">Weight (G)</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-orange-50/30 w-[60px]">Less</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-orange-50/30 w-[80px]">Act Touch</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-orange-50/30 w-[80px]">Tkn Touch</th>
                            <th className="px-3 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-orange-50/30 font-bold w-[80px]">Purity (C)</th>
                            {!isReadOnly && <th className="px-4 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest bg-gray-50 w-[100px]">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan="24" className="py-20">
                                    <div className="flex flex-col items-center justify-center text-gray-400 gap-4">
                                        <Loader2 className="animate-spin text-yellow-400" size={32} />
                                        <p className="font-bold text-sm tracking-tight">Fetching history...</p>
                                    </div>
                                </td>
                            </tr>
                        ) : transactions.length === 0 ? (
                            <tr>
                                <td colSpan="24" className="py-20 text-center text-gray-400 font-bold">
                                    No transactions found.
                                </td>
                            </tr>
                        ) : transactions.map((txn) => {
                            const rowCount = Math.max(txn.issuedItems?.length || 0, txn.receiptItems?.length || 0, 1);
                            return Array.from({ length: rowCount }).map((_, idx) => (
                                <tr key={`${txn._id}-${idx}`} className={`group hover:bg-gray-50/50 transition-all ${idx === 0 ? 'border-t-2 border-gray-100' : 'border-t border-gray-50'}`}>
                                    {/* Customer Info (Only show on first row of group or keep visible) */}
                                    {idx === 0 ? (
                                        <>
                                            <td className="px-4 py-4 font-black text-yellow-600 text-[10px] border-r border-gray-100 text-center" rowSpan={rowCount}>
                                                {transactions.indexOf(txn) + 1}
                                            </td>
                                            <td className="px-4 py-4 font-black text-gray-900 text-[11px] border-r border-gray-100" rowSpan={rowCount}>
                                                {txn.customerDetails?.name}
                                            </td>
                                            <td className="px-4 py-4 font-bold text-gray-500 text-[11px] border-r border-gray-100" rowSpan={rowCount}>
                                                {txn.customerDetails?.phone}
                                            </td>
                                            <td className="px-4 py-4 font-bold text-gray-500 text-[10px] border-r border-gray-100" rowSpan={rowCount}>
                                                {txn.date ? format(new Date(txn.date), 'dd/MM/yy') : '-'}
                                            </td>
                                            <td className="px-4 py-4 font-black text-gray-900 text-[10px] border-r border-gray-200" rowSpan={rowCount}>
                                                {txn.time}
                                            </td>
                                        </>
                                    ) : null}

                                    {/* Issued Item Details */}
                                    <td className="px-3 py-4 text-[10px] font-bold text-gray-600 bg-emerald-50/5 whitespace-nowrap">{txn.issuedItems?.[idx]?.billNo || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-gray-600 bg-emerald-50/5 whitespace-nowrap">{txn.issuedItems?.[idx]?.serialNo || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-gray-900 bg-emerald-50/5 whitespace-nowrap">{txn.issuedItems?.[idx]?.itemName || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-black text-gray-900 bg-emerald-50/5 whitespace-nowrap">{(txn.issuedItems?.[idx]?.netWeight || txn.issuedItems?.[idx]?.weight) ? `${txn.issuedItems[idx].netWeight || txn.issuedItems[idx].weight}g` : '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-gray-400 bg-emerald-50/5 whitespace-nowrap text-center">{txn.issuedItems?.[idx]?.currentCount || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-black text-emerald-600 bg-emerald-50/5 whitespace-nowrap text-center">{txn.issuedItems?.[idx]?.purchaseCount || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-gray-600 bg-emerald-50/5 whitespace-nowrap">{txn.issuedItems?.[idx]?.purity || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-gray-400 bg-emerald-50/5 whitespace-nowrap">₹{txn.issuedItems?.[idx]?.sriCost?.toLocaleString() || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-black text-emerald-700 bg-emerald-50/10 whitespace-nowrap">₹{txn.issuedItems?.[idx]?.sriBill?.toLocaleString() || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-orange-600 bg-emerald-50/5 border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] whitespace-nowrap">{txn.issuedItems?.[idx]?.plus ? `+${txn.issuedItems[idx].plus}` : '-'}</td>

                                    {/* Receipt Item Details */}
                                    <td className="px-3 py-4 text-[10px] font-bold text-gray-600 bg-orange-50/5 whitespace-nowrap">{txn.receiptItems?.[idx]?.billNo || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-gray-600 bg-orange-50/5 whitespace-nowrap">{txn.receiptItems?.[idx]?.serialNo || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-gray-900 bg-orange-50/5 whitespace-nowrap">{txn.receiptItems?.[idx]?.receiptType || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-black text-gray-900 bg-orange-50/5 whitespace-nowrap">{(txn.receiptItems?.[idx]?.weight || txn.receiptItems?.[idx]?.netWeight) ? `${txn.receiptItems[idx].weight || txn.receiptItems[idx].netWeight}g` : '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-gray-600 bg-orange-50/5 whitespace-nowrap">{txn.receiptItems?.[idx]?.less || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-green-600 bg-orange-50/5 whitespace-nowrap">{txn.receiptItems?.[idx]?.actualTouch || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-emerald-600 bg-orange-50/5 whitespace-nowrap">{txn.receiptItems?.[idx]?.takenTouch || '-'}</td>
                                    <td className="px-3 py-4 text-[10px] font-bold text-gray-600 bg-orange-50/5 whitespace-nowrap">{txn.receiptItems?.[idx]?.purity || '-'}</td>
                                    {idx === 0 && !isReadOnly && (
                                        <td className="px-4 py-4 text-center border-l border-gray-100" rowSpan={rowCount}>
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/sales/edit/${txn._id}`)}
                                                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => deleteSale(txn._id)}
                                                    className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ));
                        })}
                    </tbody>
                </table>

                {/* Pagination Placeholder */}
                <div className="px-6 py-5 bg-gray-50/30 flex items-center justify-between border-t border-gray-50">
                    <p className="text-xs font-bold text-gray-400">
                        Showing {transactions.length} entries
                    </p>
                    <div className="flex items-center gap-1">
                        <button className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30" disabled><ChevronLeft size={18} /></button>
                        <button className="w-8 h-8 rounded-lg bg-yellow-400 text-gray-900 font-black text-xs">1</button>
                        <button className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30" disabled><ChevronRight size={18} /></button>
                    </div>
                </div>
            </div>

            {/* Dealer Transactions */}
            <div className="mt-10 bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 bg-gray-900">
                    <h3 className="text-sm font-black text-yellow-400 uppercase tracking-[0.2em] text-center">Dealer Transaction</h3>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/70">
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">S.No</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Name</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Time</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Phone No</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Amount</th>
                                {!isReadOnly && <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {dealerLoading ? (
                                <tr>
                                    <td colSpan={isReadOnly ? 6 : 7} className="py-14">
                                        <div className="flex items-center justify-center gap-3 text-gray-400">
                                            <Loader2 className="animate-spin text-yellow-400" size={22} />
                                            <p className="font-bold text-sm">Fetching dealer transactions...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : dealerTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={isReadOnly ? 6 : 7} className="py-14 text-center text-gray-400 font-bold">
                                        No dealer transactions found.
                                    </td>
                                </tr>
                            ) : (
                                dealerTransactions.map((txn, idx) => {
                                    const amount = Number(txn.balanceAfter ?? txn.amount ?? 0);
                                    const amountClass = amount >= 0 ? 'text-emerald-600' : 'text-red-600';
                                    return (
                                        <tr key={txn._id || idx} className="hover:bg-gray-50/50 transition-all">
                                            <td className="px-4 py-4 font-black text-yellow-600 text-[11px]">{(dealerPage - 1) * 10 + idx + 1}</td>
                                            <td className="px-4 py-4 font-black text-gray-900 text-[11px]">{txn.name || '-'}</td>
                                            <td className="px-4 py-4 font-bold text-gray-500 text-[11px]">{formatDateSafe(txn.date)}</td>
                                            <td className="px-4 py-4 font-black text-gray-700 text-[11px]">{txn.time || '-'}</td>
                                            <td className="px-4 py-4 font-bold text-gray-500 text-[11px]">{txn.phoneNumber || '-'}</td>
                                            <td className={`px-4 py-4 font-black text-[12px] text-right ${amountClass}`}>
                                                ₹{Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            {!isReadOnly && (
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => navigate('/admin/dealers', { state: { dealerName: txn.name } })}
                                                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteDealerTxn(txn._id, 'Dealer')}
                                                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Dealer Pagination */}
                <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400">Page {dealerPage} of {dealerTotalPages}</span>
                    <div className="flex gap-2">
                        <button
                            disabled={dealerPage === 1}
                            onClick={() => setDealerPage(prev => prev - 1)}
                            className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            disabled={dealerPage === dealerTotalPages}
                            onClick={() => setDealerPage(prev => prev + 1)}
                            className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Line Stock Transactions */}
            <div className="mt-10 bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 bg-gray-900">
                    <h3 className="text-sm font-black text-yellow-400 uppercase tracking-[0.2em] text-center">Line Stock Transaction</h3>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/70">
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">S.No</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Name</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Time</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Phone No</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Balance After (g)</th>
                                {!isReadOnly && <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {lineStockLoading ? (
                                <tr>
                                    <td colSpan={isReadOnly ? 6 : 7} className="py-14">
                                        <div className="flex items-center justify-center gap-3 text-gray-400">
                                            <Loader2 className="animate-spin text-yellow-400" size={22} />
                                            <p className="font-bold text-sm">Fetching line stock transactions...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : lineStockTxns.length === 0 ? (
                                <tr>
                                    <td colSpan={isReadOnly ? 6 : 7} className="py-14 text-center text-gray-400 font-bold">
                                        No line stock transactions found.
                                    </td>
                                </tr>
                            ) : (
                                lineStockTxns.map((txn, idx) => {
                                    const balance = Number(txn.balanceAfter ?? 0);
                                    const balanceClass = balance >= 0 ? 'text-amber-600' : 'text-emerald-600';
                                    return (
                                        <tr key={txn._id || idx} className="hover:bg-gray-50/50 transition-all">
                                            <td className="px-4 py-4 font-black text-yellow-600 text-[11px]">{(lineStockPage - 1) * 10 + idx + 1}</td>
                                            <td className="px-4 py-4 font-black text-gray-900 text-[11px]">{txn.name || '-'}</td>
                                            <td className="px-4 py-4 font-bold text-gray-500 text-[11px]">{formatDateSafe(txn.date)}</td>
                                            <td className="px-4 py-4 font-black text-gray-700 text-[11px]">{txn.time || '-'}</td>
                                            <td className="px-4 py-4 font-bold text-gray-500 text-[11px]">{txn.phoneNumber || '-'}</td>
                                            <td className={`px-4 py-4 font-black text-[12px] text-right ${balanceClass}`}>
                                                {balance.toFixed(3)} g
                                            </td>
                                            {!isReadOnly && (
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => navigate('/admin/dealers', { state: { dealerName: txn.name } })}
                                                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteDealerTxn(txn._id, 'Line Stocker')}
                                                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Line Stock Pagination */}
                <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400">Page {lineStockPage} of {lineStockTotalPages}</span>
                    <div className="flex gap-2">
                        <button
                            disabled={lineStockPage === 1}
                            onClick={() => setLineStockPage(prev => prev - 1)}
                            className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            disabled={lineStockPage === lineStockTotalPages}
                            onClick={() => setLineStockPage(prev => prev + 1)}
                            className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Details Modal */}
            {isModalOpen && selectedTxn && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center text-gray-900 shadow-lg shadow-yellow-100">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Transaction Details</h3>
                                    <p className="text-xs font-bold text-gray-400">#TXN-{selectedTxn._id.toUpperCase()}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-xl transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            {/* Customer & Summary */}
                            <div className="grid grid-cols-1 gap-6">
                                <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Customer Information</p>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-400"><User size={14} /></div>
                                            <div><p className="text-xs font-black text-gray-900">{selectedTxn.customerDetails.name}</p></div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-400"><Calendar size={14} /></div>
                                            <div>
                                                <p className="text-[9px] text-gray-400 font-black uppercase">Date & Time</p>
                                                <p className="text-xs font-black text-gray-900">{selectedTxn.date ? format(new Date(selectedTxn.date), 'dd MMM yyyy') : '-'} | {selectedTxn.time}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Issued Items */}
                            {selectedTxn.issuedItems?.length > 0 && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                                        <h4 className="font-black text-gray-900 tracking-tight">Issued Products</h4>
                                    </div>
                                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-[10px]">
                                                <thead className="bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">Bill No / ID</th>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">Item Name</th>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">Category</th>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-center">Curr/Purc</th>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-right">Sri Cost/Bill</th>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">Weight (G)</th>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-right">Purity</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {selectedTxn.issuedItems.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50/50 transition-all">
                                                            <td className="px-4 py-3">
                                                                <p className="font-black text-gray-900">{item.billNo || '-'}</p>
                                                                <p className="text-[9px] text-gray-400 font-bold">SN: {item.serialNo || '-'}</p>
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-gray-900">{item.itemName}</td>
                                                            <td className="px-4 py-3">
                                                                <p className="font-bold text-gray-600">{item.jewelleryType || '-'}</p>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <p className="font-bold text-gray-400">{item.currentCount || 0}</p>
                                                                <p className="font-black text-emerald-600">{item.purchaseCount || 0}</p>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <p className="font-bold text-gray-400 line-through text-[9px]">₹{(item.sriCost || 0).toLocaleString()}</p>
                                                                <p className="font-black text-yellow-600">₹{(item.sriBill || 0).toLocaleString()}</p>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="text-emerald-600 font-black">{item.netWeight || 0}g</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <p className="font-bold text-gray-600">{item.purity || '-'}</p>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Receipt Items */}
                            {selectedTxn.receiptItems?.length > 0 && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
                                        <h4 className="font-black text-gray-900 tracking-tight">Receipt / Old Gold</h4>
                                    </div>
                                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-[10px]">
                                                <thead className="bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">Bill / Type</th>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">Serial No</th>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">Weight / Less</th>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest">Touch (A/T)</th>
                                                        <th className="px-4 py-3 font-black text-gray-400 uppercase tracking-widest text-right">Purity (C)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {selectedTxn.receiptItems.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50/50 transition-all">
                                                            <td className="px-4 py-3">
                                                                <p className="font-black text-gray-900">{item.billNo || '-'}</p>
                                                                <p className="text-[9px] text-gray-500 font-bold uppercase">{item.receiptType}</p>
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-gray-600">
                                                                {item.serialNo || '-'}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <p className="font-black text-gray-700">{item.weight || 0}g</p>
                                                                <p className="text-[9px] font-bold text-gray-400">Less: {item.less || 0}g</p>
                                                            </td>
                                                            <td className="px-4 py-3 font-bold">
                                                                <div className="flex gap-2">
                                                                    <span className="text-green-600">A: {item.actualTouch || 0}</span>
                                                                    <span className="text-emerald-600">T: {item.takenTouch || 0}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 font-black text-gray-900 text-right">
                                                                {item.purity || '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                            <button className="flex items-center gap-2 text-xs font-black text-gray-400 hover:text-gray-900 transition-all uppercase tracking-widest">
                                <Download size={16} /> Print Items List
                            </button>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setIsModalOpen(false)} className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black text-xs hover:bg-black transition-all">
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Transactions;
