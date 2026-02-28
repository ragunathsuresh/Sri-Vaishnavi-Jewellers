import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Search, Download, Loader2 } from 'lucide-react';
import api from '../axiosConfig';
import ExpenseTable from '../components/expenses/ExpenseTable';
import ExpenseFormModal from '../components/expenses/ExpenseFormModal';

const todayDateInput = () => new Date().toISOString().slice(0, 10);

const ExpensePage = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [fromDate, setFromDate] = useState(todayDateInput());
    const [toDate, setToDate] = useState(todayDateInput());
    const [expenseType, setExpenseType] = useState('All');
    const [summary, setSummary] = useState({ todayTotal: 0, monthTotal: 0 });
    const [serverNow, setServerNow] = useState(new Date());
    const [errorMessage, setErrorMessage] = useState('');
    const [exporting, setExporting] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [editingRow, setEditingRow] = useState(null);

    const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(Number(value || 0));

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                from: fromDate,
                to: toDate,
                expenseType
            };
            if (search.trim()) params.search = search.trim();

            const { data } = await api.get('/expenses', { params });
            setRows(data?.data || []);
            setSummary({
                todayTotal: Number(data?.summary?.todayTotal || 0),
                monthTotal: Number(data?.summary?.monthTotal || 0)
            });
            if (data?.serverDateTime?.iso) {
                setServerNow(new Date(data.serverDateTime.iso));
            }
            setErrorMessage('');
        } catch (error) {
            setRows([]);
            setSummary({ todayTotal: 0, monthTotal: 0 });
            setErrorMessage(error.response?.data?.message || 'Failed to fetch expenses');
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate, expenseType, search]);

    const syncServerTime = async () => {
        try {
            const { data } = await api.get('/expenses/server-time');
            if (data?.data?.iso) {
                setServerNow(new Date(data.data.iso));
            }
        } catch {
            // silent clock sync failure
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchExpenses();
        }, 250);
        return () => clearTimeout(timer);
    }, [fetchExpenses]);

    useEffect(() => {
        syncServerTime();
        const syncInterval = setInterval(syncServerTime, 30000);
        const tickInterval = setInterval(() => {
            setServerNow((prev) => new Date(prev.getTime() + 1000));
        }, 1000);
        return () => {
            clearInterval(syncInterval);
            clearInterval(tickInterval);
        };
    }, []);

    const submitModal = async (payload) => {
        setSaving(true);
        try {
            if (modalMode === 'edit' && editingRow?._id) {
                await api.put(`/expenses/${editingRow._id}`, payload);
            } else {
                await api.post('/expenses', payload);
            }
            setIsModalOpen(false);
            setEditingRow(null);
            await fetchExpenses();
            setErrorMessage('');
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Failed to save expense');
        } finally {
            setSaving(false);
        }
    };

    const openCreateModal = () => {
        setModalMode('add');
        setEditingRow(null);
        setIsModalOpen(true);
    };

    const openEditModal = (row) => {
        setModalMode('edit');
        setEditingRow(row);
        setIsModalOpen(true);
    };

    const handleDelete = async (row) => {
        try {
            await api.delete(`/expenses/${row._id}`);
            await fetchExpenses();
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Failed to delete expense');
        }
    };

    const liveDate = useMemo(() => serverNow.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }), [serverNow]);

    const liveTime = useMemo(() => serverNow.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }), [serverNow]);

    const toCsvCell = (value) => {
        const str = String(value ?? '');
        return `"${str.replace(/"/g, '""')}"`;
    };
    const toExcelText = (value) => `'${String(value ?? '')}`;
    const formatDateForCsv = (value) => {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const handleExportCsv = async () => {
        try {
            setExporting(true);
            const params = {
                from: fromDate,
                to: toDate,
                expenseType
            };
            if (search.trim()) params.search = search.trim();

            const { data } = await api.get('/expenses', { params });
            const exportRows = data?.data || [];

            const header = ['S.No', 'Expense Name', 'Expense Type', 'Date', 'Time', 'Amount', 'Notes'];
            const body = exportRows.map((row, idx) => [
                idx + 1,
                row.expenseName || '-',
                row.expenseType || '-',
                toExcelText(formatDateForCsv(row.expenseDate)),
                toExcelText(row.expenseTime || '-'),
                Number(row.amount || 0).toFixed(2),
                row.notes || '-'
            ]);

            const totalAmount = exportRows.reduce((sum, row) => sum + (Number(row.amount || 0) || 0), 0);

            const csv = [
                header.map(toCsvCell).join(','),
                ...body.map((r) => r.map(toCsvCell).join(',')),
                '',
                ['TOTAL', '', '', '', '', totalAmount.toFixed(2), ''].map(toCsvCell).join(',')
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            link.href = url;
            link.setAttribute('download', `expenses-${stamp}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export expenses CSV', error);
            setErrorMessage(error.response?.data?.message || 'Failed to export expenses');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-7">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Expense Management</h1>
                    <p className="text-gray-500 mt-1">Daily and Monthly expense tracking</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportCsv}
                        disabled={exporting || loading}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-bold shadow-sm disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                        {exporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                    <div className="bg-white border border-yellow-100 rounded-xl px-4 py-2 shadow-sm">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Current Date & Time</p>
                        <p className="text-sm font-black text-gray-900">{liveDate}</p>
                        <p className="text-lg font-black text-gray-900">{liveTime}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                    <p className="text-sm text-gray-500 font-semibold">Today&apos;s Total Expenses</p>
                    <p className="text-3xl font-black text-gray-900 mt-1">{formatCurrency(summary.todayTotal)}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                    <p className="text-sm text-gray-500 font-semibold">This Month Total Expenses</p>
                    <p className="text-3xl font-black text-gray-900 mt-1">{formatCurrency(summary.monthTotal)}</p>
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 md:p-5 mb-5">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-center">
                    <div className="xl:col-span-4 relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by expense name"
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                        />
                    </div>
                    <div className="xl:col-span-2 relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                        />
                    </div>
                    <div className="xl:col-span-2 relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                        />
                    </div>
                    <div className="xl:col-span-2">
                        <select
                            value={expenseType}
                            onChange={(e) => setExpenseType(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                        >
                            <option value="All">All</option>
                            <option value="Daily">Daily</option>
                            <option value="Monthly">Monthly</option>
                        </select>
                    </div>
                    <div className="xl:col-span-2">
                        <button
                            onClick={openCreateModal}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-extrabold shadow-md"
                        >
                            <Plus size={18} />
                            Add New Expense
                        </button>
                    </div>
                </div>
            </div>

            {errorMessage ? (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {errorMessage}
                </div>
            ) : null}

            <ExpenseTable
                rows={rows}
                loading={loading}
                onEdit={openEditModal}
                onDelete={handleDelete}
            />

            <ExpenseFormModal
                key={`${modalMode}-${editingRow?._id || 'new'}-${isModalOpen ? 'open' : 'closed'}`}
                isOpen={isModalOpen}
                mode={modalMode}
                initialData={editingRow}
                onClose={() => setIsModalOpen(false)}
                onSubmit={submitModal}
                saving={saving}
            />
        </div>
    );
};

export default ExpensePage;
