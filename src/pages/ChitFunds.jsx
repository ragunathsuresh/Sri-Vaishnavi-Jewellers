import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Plus, Search, Download, Loader2, UserPlus, X, Trash2, Pencil } from 'lucide-react';
import api from '../axiosConfig';
import { useDevice } from '../context/DeviceContext';

const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const formatCurrency = (value) => `Rs.${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const ChitFunds = () => {
    const { isReadOnly, isMobile } = useDevice();
    const navigate = useNavigate();
    const location = useLocation();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [todayRate, setTodayRate] = useState(0);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [toast, setToast] = useState(null);
    const [totalCash, setTotalCash] = useState(0);
    const [totalGrams, setTotalGrams] = useState(0);
    const [exporting, setExporting] = useState(false);
    const [showUserSearch, setShowUserSearch] = useState(false);
    const [userQuery, setUserQuery] = useState('');
    const [userResults, setUserResults] = useState([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    const fetchTodayRate = async () => {
        try {
            const { data } = await api.get('/chit-funds/today-rate');
            setTodayRate(Number(data?.data?.rate || 0));
        } catch (error) {
            console.error('Failed to fetch today rate', error);
        }
    };

    const fetchRows = async () => {
        setLoading(true);
        try {
            const params = { page, limit };
            if (search.trim()) params.search = search.trim();
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const { data } = await api.get('/chit-funds', { params });
            setRows(data?.data || []);
            setPagination(data?.pagination || { page: 1, totalPages: 1, total: 0 });
            setTotalCash(Number(data?.summary?.totalAmount || 0));
            setTotalGrams(Number(data?.summary?.totalGrams || 0));
        } catch (error) {
            console.error('Failed to fetch chit funds', error);
            setRows([]);
            setTotalCash(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTodayRate();
    }, []);

    useEffect(() => {
        if (location.state?.toast) {
            setToast(location.state.toast);
            window.history.replaceState({}, document.title);
            const timer = setTimeout(() => setToast(null), 2200);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [location.state]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchRows();
        }, 250);
        return () => clearTimeout(timer);
    }, [page, search, startDate, endDate]);

    const pageNumbers = useMemo(() => {
        const pages = [];
        for (let i = 1; i <= pagination.totalPages; i += 1) {
            pages.push(i);
        }
        return pages;
    }, [pagination.totalPages]);

    const toCsvCell = (value) => {
        const str = String(value ?? '');
        return `"${str.replace(/"/g, '""')}"`;
    };
    const toExcelText = (value) => `'${String(value ?? '')}`;

    const handleUserSearch = async (query) => {
        setUserQuery(query);
        if (query.trim().length < 2) {
            setUserResults([]);
            return;
        }
        setSearchingUsers(true);
        try {
            const { data } = await api.get('/chit-funds/customers/search', { params: { query } });
            setUserResults(data?.data || []);
        } catch (error) {
            console.error('User search failed', error);
        } finally {
            setSearchingUsers(false);
        }
    };

    const handleDeleteUserHistory = async (phone, name) => {
        try {
            await api.delete(`/chit-funds/customers/${phone}`);
            setToast({ type: 'success', message: `Deleted history for ${name}` });
            setUserResults(prev => prev.filter(u => u.phoneNumber !== phone));
            fetchRows();
        } catch (error) {
            console.error('Delete history failed', error);
            setToast({ type: 'error', message: 'Failed to delete history' });
        }
    };

    const handleDelete = async (id) => {
        try {
            const { data } = await api.delete(`/chit-funds/${id}`);
            if (data.success) {
                setToast({ type: 'success', message: 'Entry deleted successfully' });
                fetchRows();
            } else {
                setToast({ type: 'error', message: data.message || 'Failed to delete' });
            }
        } catch (error) {
            console.error('Delete error:', error);
            setToast({ type: 'error', message: error.response?.data?.message || 'Failed to delete' });
        }
    };

    const handleExportCsv = async () => {
        try {
            setExporting(true);
            const params = { page: 1, limit: 5000 };
            if (search.trim()) params.search = search.trim();
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const { data } = await api.get('/chit-funds', { params });
            const exportRows = data?.data || [];

            const header = ['S.No', 'Customer Name', 'Date', 'Time', 'Phone Number', 'Amount', 'Gold Rate (Today)', 'Rate Applied', 'Grams Purchased'];
            const body = exportRows.map((row, idx) => [
                idx + 1,
                row.customerName || '-',
                toExcelText(formatDate(row.date)),
                row.time || '-',
                row.phoneNumber || '-',
                Number(row.amount || 0).toFixed(2),
                Number(row.goldRateToday || 0).toFixed(2),
                Number(row.rateApplied || 0).toFixed(2),
                Number(row.gramsPurchased || 0).toFixed(3)
            ]);

            const totals = exportRows.reduce((acc, row) => {
                acc.amount += Number(row.amount || 0);
                acc.grams += Number(row.gramsPurchased || 0);
                return acc;
            }, { amount: 0, grams: 0 });

            const csv = [
                header.map(toCsvCell).join(','),
                ...body.map((r) => r.map(toCsvCell).join(',')),
                '',
                ['TOTAL', '', '', '', '', totals.amount.toFixed(2), '', '', totals.grams.toFixed(3)].map(toCsvCell).join(',')
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            link.href = url;
            link.setAttribute('download', `chit-funds-${stamp}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export chit funds CSV', error);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                        }`}
                >
                    {toast.message}
                </div>
            )}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-7">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Chit Fund Management</h1>
                    <p className="text-gray-500 mt-1">Daily collections, gold conversion, and customer ledger.</p>
                </div>
                <div className={`flex flex-wrap items-center gap-3 ${isMobile ? 'order-last' : ''}`}>
                    <div className="bg-white border border-yellow-100 rounded-xl px-4 py-2 shadow-sm">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Today's Gold Rate (22K)</p>
                        <p className="text-2xl font-black text-gray-900">{formatCurrency(todayRate)}<span className="text-base font-semibold text-gray-500">/gm</span></p>
                    </div>
                    <button
                        onClick={handleExportCsv}
                        disabled={exporting || loading}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-bold shadow-sm disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                        {exporting ? 'Export CSV' : 'Export CSV'}
                    </button>
                    <button
                        onClick={() => setShowUserSearch(!showUserSearch)}
                        className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl border font-bold shadow-sm transition-all ${showUserSearch ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'}`}
                    >
                        {showUserSearch ? <X size={18} /> : <UserPlus size={18} />}
                        {showUserSearch ? 'Close' : 'User History'}
                    </button>
                    {!isReadOnly && (
                        <>
                            <button
                                onClick={() => navigate('/admin/chit/past/new')}
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-bold shadow-sm"
                            >
                                <Plus size={18} />
                                Add Past Entry
                            </button>
                            <button
                                onClick={() => navigate('/admin/chit/new')}
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-extrabold shadow-md"
                            >
                                <Plus size={18} />
                                Add New Entry
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 md:p-5 mb-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2 relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search by customer name or phone"
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setPage(1);
                            }}
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setPage(1);
                            }}
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                        />
                    </div>
                </div>
            </div>

            {showUserSearch && (
                <div className="bg-white border-2 border-yellow-400 rounded-2xl shadow-xl p-6 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-black text-gray-900">User History Details</h3>
                        <div className="relative w-full max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Enter customer name or phone number..."
                                value={userQuery}
                                onChange={(e) => handleUserSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-gray-200 border-2 focus:border-yellow-400 focus:ring-0 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {searchingUsers ? (
                            <div className="col-span-full py-10 flex flex-col items-center justify-center text-gray-400">
                                <Loader2 className="animate-spin mb-2" size={32} />
                                <p className="font-bold">Searching records...</p>
                            </div>
                        ) : userResults.length > 0 ? (
                            userResults.map((user) => (
                                <div key={user._id || user.phoneNumber} className="bg-gray-50 border border-gray-100 rounded-2xl p-5 hover:border-yellow-200 transition-all group relative">
                                    {!isReadOnly && (
                                        <button
                                            onClick={() => handleDeleteUserHistory(user.phoneNumber, user.customerName)}
                                            className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
                                            title="Delete entire history"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                    <div className="mb-4">
                                        <h4 className="text-lg font-black text-gray-900">{user.customerName}</h4>
                                        <p className="text-sm text-gray-500 font-semibold">{user.phoneNumber}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Total Amount</p>
                                            <p className="text-sm font-black text-gray-900">{formatCurrency(user.totalAmount)}</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Total Grams</p>
                                            <p className="text-sm font-black text-yellow-700">{Number(user.totalGrams || 0).toFixed(3)} g</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-gray-200/50 flex items-center justify-between text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                        <span>Last Activity</span>
                                        <span className="text-gray-600">{formatDate(user.lastTransaction)}</span>
                                    </div>
                                </div>
                            ))
                        ) : userQuery.length >= 2 ? (
                            <div className="col-span-full py-10 text-center text-gray-400">
                                <p className="font-bold">No customer found with that name.</p>
                            </div>
                        ) : (
                            <div className="col-span-full py-10 text-center text-gray-400">
                                <p className="font-bold italic">Start typing at least 2 characters to search...</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full min-w-[1120px]">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            {['S.No', 'Customer Name', 'Date', 'Time', 'Phone Number', 'Amount', 'Gold Rate', 'Rate Applied', 'Grams Purchased'].map((label) => (
                                <th key={label} className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-black text-gray-500">{label}</th>
                            ))}
                            {!isReadOnly && <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-black text-gray-500">Action</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="9" className="text-center py-16 text-gray-400 font-semibold">Loading chit entries...</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="text-center py-16 text-gray-400 font-semibold">No records found.</td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => (
                                <tr key={row._id} className="border-b border-gray-50 hover:bg-yellow-50/30">
                                    <td className="px-4 py-3 text-sm font-bold text-gray-700">{(page - 1) * limit + idx + 1}</td>
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.customerName}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.date)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{row.time || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{row.phoneNumber}</td>
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(row.amount)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(row.goldRateToday)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(row.rateApplied)}</td>
                                    <td className="px-4 py-3 text-sm font-extrabold text-yellow-700">{Number(row.gramsPurchased || 0).toFixed(3)} gms</td>
                                    {!isReadOnly && (
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/chit/${row.isPastEntry ? 'past/edit' : 'edit'}/${row._id}`)}
                                                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(row._id)}
                                                    className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <p className="text-sm text-gray-500">
                    Showing <span className="font-semibold text-gray-800">{rows.length}</span> of <span className="font-semibold text-gray-800">{pagination.total}</span> results
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40"
                    >
                        Prev
                    </button>
                    {pageNumbers.map((p) => (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`px-3 py-1.5 rounded-lg border text-sm font-bold ${p === page ? 'bg-yellow-400 border-yellow-400 text-gray-900' : 'border-gray-200 text-gray-700'}`}
                        >
                            {p}
                        </button>
                    ))}
                    <button
                        onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
                        disabled={page === pagination.totalPages}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            </div>

            <div className="mt-5 flex justify-end gap-4">
                <div className="bg-white border border-yellow-200 rounded-xl shadow-sm px-5 py-4 min-w-[220px]">
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Total Grams Purchased</p>
                    <p className="text-2xl font-black text-yellow-700 mt-1">
                        {Number(totalGrams).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-base font-semibold text-gray-500">gms</span>
                    </p>
                </div>
                <div className="bg-white border border-yellow-200 rounded-xl shadow-sm px-5 py-4 min-w-[220px]">
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Total Cash</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">
                        {formatCurrency(totalCash)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChitFunds;
