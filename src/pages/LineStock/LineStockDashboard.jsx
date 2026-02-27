import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { lineStockService } from '../../services/lineStockService';
import api from '../../axiosConfig';
import { Plus, Search, Filter, Calendar, ChevronRight, AlertCircle, CheckCircle, Clock, Download, UserPlus, X, Loader2 } from 'lucide-react';

const LineStockDashboard = () => {
    const navigate = useNavigate();
    const [lineStocks, setLineStocks] = useState([]);
    const [summary, setSummary] = useState({ active: 0, overdue: 0, settled: 0, today: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [exporting, setExporting] = useState(false);

    // Add User (Line Stocker with Past Balance) state
    const [showAddUser, setShowAddUser] = useState(false);
    const [addForm, setAddForm] = useState({
        name: '',
        phoneNumber: '',
        balance: '',
        date: new Date().toISOString().split('T')[0],
        status: 'issue'
    });
    const [addSaving, setAddSaving] = useState(false);
    const [addError, setAddError] = useState('');

    useEffect(() => {
        fetchLineStocks();
    }, [page, statusFilter]);

    const fetchLineStocks = async () => {
        try {
            setLoading(true);
            const data = await lineStockService.getAll({
                page,
                search,
                status: statusFilter,
                limit: 10
            });
            setLineStocks(data?.lineStocks || []);
            setTotalPages(data?.totalPages || 1);

            // Calculate summary (In a real app, this might come from a separate API)
            // For now, we'll just use the current data or another fetch if needed
            const allData = await lineStockService.getAll({ limit: 1000 });
            if (!allData || !allData.lineStocks) return;
            const now = new Date();
            const today = now.toISOString().split('T')[0];

            const stats = (allData.lineStocks || []).reduce((acc, ls) => {
                if (ls.status === 'ISSUED') acc.active++;
                if (ls.status === 'OVERDUE') acc.overdue++;
                if (ls.status === 'SETTLED' || ls.status === 'CLOSED') acc.settled++;
                if (ls.issuedDate && ls.issuedDate.split('T')[0] === today) acc.today++;
                return acc;
            }, { active: 0, overdue: 0, settled: 0, today: 0 });

            setSummary(stats);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching line stocks:', error);
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        if (e.key === 'Enter') {
            setPage(1);
            fetchLineStocks();
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'ISSUED': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'OVERDUE': return 'bg-red-100 text-red-800 border-red-200';
            case 'SETTLED': return 'bg-green-100 text-green-800 border-green-200';
            case 'CLOSED': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const toCsvCell = (value) => {
        const str = String(value ?? '');
        return `"${str.replace(/"/g, '""')}"`;
    };
    const toExcelText = (value) => `'${String(value ?? '')}`;

    const handleExportCsv = async () => {
        try {
            setExporting(true);
            const data = await lineStockService.getAll({
                page: 1,
                search,
                status: statusFilter,
                limit: 5000
            });
            const rows = data?.lineStocks || [];

            const header = [
                'Serial No',
                'Sales Person',
                'Phone Number',
                'Issued Date',
                'Expected Return',
                'Value (g)',
                'Status',
                'Returned (g)',
                'Balance (g)'
            ];

            const body = rows.map((ls, idx) => {
                const value = Number(ls?.totals?.manualValue ?? ls?.totals?.issued ?? 0);
                const returned = Number(ls?.totals?.returned ?? 0);
                const balance = value - returned;
                return [
                    idx + 1,
                    ls.personName || '',
                    ls.phoneNumber || '',
                    toExcelText(ls.issuedDate ? new Date(ls.issuedDate).toLocaleDateString() : '-'),
                    toExcelText(ls.expectedReturnDate ? new Date(ls.expectedReturnDate).toLocaleDateString() : '-'),
                    value.toFixed(3),
                    ls.status || '',
                    returned.toFixed(3),
                    balance.toFixed(3)
                ];
            });

            const totals = rows.reduce((acc, ls) => {
                acc.value += Number(ls?.totals?.manualValue ?? ls?.totals?.issued ?? 0) || 0;
                acc.returned += Number(ls?.totals?.returned ?? 0) || 0;
                acc.balance = acc.value - acc.returned;
                return acc;
            }, { value: 0, returned: 0, balance: 0 });

            const csv = [
                header.map(toCsvCell).join(','),
                ...body.map((row) => row.map(toCsvCell).join(',')),
                '',
                ['TOTAL', '', '', '', '', totals.value.toFixed(3), '', totals.returned.toFixed(3), totals.balance.toFixed(3)].map(toCsvCell).join(',')
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            link.href = url;
            link.setAttribute('download', `line-stock-${stamp}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting line stock CSV:', error);
        } finally {
            setExporting(false);
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setAddError('');
        if (!addForm.name.trim()) { setAddError('Name is required'); return; }
        setAddSaving(true);
        try {
            // Unified Call: Creates both the Dealer Account and the Line Stock Dashboard Entry
            const lsStatus = addForm.status === 'issue' ? 'ISSUED' : (addForm.status === 'overdue' ? 'OVERDUE' : 'SETTLED');
            await api.post('/line-stock/manual', {
                personName: addForm.name.trim(),
                phoneNumber: addForm.phoneNumber.trim(),
                status: lsStatus,
                expectedReturnDate: addForm.date,
                issuedDate: addForm.status === 'overdue' ? null : addForm.date,
                totalValue: Number(addForm.balance) || 0
            });

            setShowAddUser(false);
            setAddForm({
                name: '',
                phoneNumber: '',
                balance: '',
                date: new Date().toISOString().split('T')[0],
                status: 'issue'
            });
            fetchLineStocks();
        } catch (error) {
            console.error('Error adding line stocker:', error);
            setAddError(error.response?.data?.message || 'Failed to add person');
        } finally {
            setAddSaving(false);
        }
    };

    return (
        <div className="p-6 bg-[#fdfbf7] min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[#b8860b] mb-1">Line Stock Dashboard</h1>
                    <p className="text-gray-500">Manage and track jewelry inventory issued to sales personnel.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowAddUser(true)}
                        className="flex items-center gap-2 border border-[#b8860b] text-[#b8860b] hover:bg-amber-50 px-6 py-3 rounded-xl transition-all font-bold"
                    >
                        <UserPlus size={20} />
                        <span>Add Person</span>
                    </button>
                    <button
                        onClick={() => navigate('/admin/line-stock/create')}
                        className="flex items-center gap-2 bg-[#b8860b] hover:bg-[#8b6508] text-white px-6 py-3 rounded-xl transition-all shadow-lg shadow-[#b8860b33]"
                    >
                        <Plus size={20} />
                        <span>Issue Stock</span>
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                    { label: 'Total Active', value: summary.active, icon: <Clock className="text-blue-600" />, color: 'blue' },
                    { label: 'Overdue Items', value: summary.overdue, icon: <AlertCircle className="text-red-600" />, color: 'red', highlight: true },
                    { label: 'Settled Today', value: summary.settled, icon: <CheckCircle className="text-green-600" />, color: 'green' },
                    { label: 'Issued Today', value: summary.today, icon: <Calendar className="text-amber-600" />, color: 'amber' }
                ].map((card, idx) => (
                    <div key={idx} className={`bg-white p-6 rounded-2xl shadow-sm border ${card.highlight ? 'border-red-200 bg-red-50' : 'border-gray-100'} transition-transform hover:scale-105`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-white shadow-sm border border-gray-50">{card.icon}</div>
                            <span className={`text-sm font-medium ${card.highlight ? 'text-red-600' : 'text-gray-400'}`}>{card.label}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-gray-800">{card.value}</span>
                            <span className="text-gray-400 text-sm">Units</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters and Search */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 mb-6 flex flex-wrap gap-4 items-center shadow-sm">
                <div className="flex-1 min-w-[300px] relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by Name or Phone..."
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleSearch}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-400" />
                    <button
                        onClick={handleExportCsv}
                        disabled={exporting}
                        className="py-3 px-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-all disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        <Download size={16} />
                        {exporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                    <select
                        className="py-3 px-4 rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#b8860b33]"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="ISSUED">Issued</option>
                        <option value="OVERDUE">Overdue</option>
                        <option value="SETTLED">Settled</option>
                        <option value="CLOSED">Closed</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-[#fdfbf7] border-b border-gray-100 text-[#b8860b] uppercase text-xs font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Serial No</th>
                            <th className="px-6 py-4">Sales Person</th>
                            <th className="px-6 py-4">Issued Date</th>
                            <th className="px-6 py-4">Expected Return</th>
                            <th className="px-6 py-4">Value (g)</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">Returned (g)</th>
                            <th className="px-6 py-4 text-center">Balance (g)</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="9" className="px-6 py-12 text-center text-gray-400">Loading records...</td></tr>
                        ) : lineStocks.length === 0 ? (
                            <tr><td colSpan="9" className="px-6 py-12 text-center text-gray-400">No records found.</td></tr>
                        ) : lineStocks.map((ls, idx) => (
                            <tr key={ls._id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-4 font-bold text-gray-700">{(page - 1) * 10 + idx + 1}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-800">{ls.personName}</span>
                                        <span className="text-xs text-gray-400">{ls.phoneNumber}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-600">{ls.issuedDate ? new Date(ls.issuedDate).toLocaleDateString() : '-'}</td>
                                <td className="px-6 py-4 text-gray-600 font-medium">
                                    {ls.expectedReturnDate ? new Date(ls.expectedReturnDate).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-700">
                                    {Number(ls?.totals?.manualValue ?? ls?.totals?.issued ?? 0).toFixed(3)} g
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(ls.status)}`}>
                                        {ls.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-700 text-center">
                                    {Number(ls?.totals?.returned ?? 0).toFixed(3)} g
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {(() => {
                                        const balance = Number(ls.dealerBalance ?? 0);
                                        const colorClass = balance <= 0
                                            ? 'text-green-600'
                                            : ls.status === 'OVERDUE'
                                                ? 'text-red-600 font-black'
                                                : 'text-amber-600 font-bold';
                                        return (
                                            <span
                                                className={`text-sm font-bold ${colorClass}`}
                                                title="Total Outstanding Balance from Debt Ledger"
                                            >
                                                {balance.toFixed(3)} g
                                            </span>
                                        );
                                    })()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => navigate(`/admin/line-stock/settle/${ls._id}`)}
                                        className="inline-flex items-center gap-1 text-[#b8860b] font-bold hover:underline group-hover:translate-x-1 transition-transform"
                                    >
                                        Settle <ChevronRight size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="px-6 py-4 bg-[#fdfbf7] border-t border-gray-100 flex justify-between items-center">
                    <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                            className="px-4 py-2 rounded-lg bg-white border border-gray-100 text-gray-600 disabled:opacity-50 hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            Previous
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(page + 1)}
                            className="px-4 py-2 rounded-lg bg-[#b8860b] text-white disabled:opacity-50 hover:bg-[#8b6508] transition-colors shadow-sm"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            {showAddUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowAddUser(false)} />
                    <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-gray-900 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-sm font-black text-yellow-500 uppercase tracking-widest">Add New Person</h3>
                            <button onClick={() => setShowAddUser(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddUser} className="p-6 space-y-5">
                            {addError && (
                                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold">
                                    {addError}
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={addForm.name}
                                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] font-bold text-gray-900"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={addForm.phoneNumber}
                                    onChange={(e) => setAddForm({ ...addForm, phoneNumber: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] font-bold text-gray-900"
                                    placeholder="Optional"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Past Balance (Grams)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={addForm.balance}
                                    onChange={(e) => setAddForm({ ...addForm, balance: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] font-black text-emerald-600"
                                    placeholder="0.000"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={addForm.date}
                                        onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] font-bold text-gray-900"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Status</label>
                                    <select
                                        value={addForm.status}
                                        onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] font-bold text-gray-900"
                                    >
                                        <option value="issue">Issue</option>
                                        <option value="overdue">Overdue</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={addSaving}
                                    className="w-full py-4 bg-[#b8860b] hover:bg-[#8b6508] text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-[#b8860b33] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {addSaving ? <Loader2 className="animate-spin" size={18} /> : null}
                                    {addSaving ? 'Saving...' : 'Add Person'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LineStockDashboard;
