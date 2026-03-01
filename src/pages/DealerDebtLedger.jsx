import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Download, Search, UserPlus, X, Pencil, Check, Trash2, AlertTriangle, ArrowUpRight } from 'lucide-react';
import api from '../axiosConfig';
import { useDevice } from '../context/DeviceContext';

const DealerDebtLedger = ({ mode = 'receivable' }) => {
    const { isReadOnly, isMobile } = useDevice();
    const navigate = useNavigate();
    const [dealers, setDealers] = useState([]);
    const [lineStockRows, setLineStockRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lineStockLoading, setLineStockLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [search, setSearch] = useState('');
    const [recentTxns, setRecentTxns] = useState([]);
    const [txnLoading, setTxnLoading] = useState(false);
    const [txnPage, setTxnPage] = useState(1);
    const [txnTotalPages, setTxnTotalPages] = useState(1);

    // Add User modal state
    const [showAddUser, setShowAddUser] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', phoneNumber: '', balance: '', dealerType: 'Dealer' });
    const [addSaving, setAddSaving] = useState(false);
    const [addError, setAddError] = useState('');

    // Deletion state
    const [isDeleting, setIsDeleting] = useState(false);

    // Inline balance edit state (Dealer table)
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [savingId, setSavingId] = useState(null);
    const editInputRef = useRef(null);

    // Inline balance edit state (Line Stock table)
    const [lsEditingName, setLsEditingName] = useState(null);
    const [lsEditValue, setLsEditValue] = useState('');
    const [lsSavingName, setLsSavingName] = useState(null);
    const lsEditInputRef = useRef(null);

    useEffect(() => {
        fetchDealers();
        fetchRecentTransactions();
        if (mode === 'receivable') fetchLineStockReceivables();
    }, [txnPage, mode]);

    const fetchDealers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/dealers');
            setDealers(data?.data || []);
        } catch (error) {
            console.error('Error fetching dealers:', error);
            setDealers([]);
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (dealer) => {
        setEditingId(dealer._id);
        setEditValue(String(Math.abs(Number(dealer.runningBalance ?? 0))));
        setTimeout(() => editInputRef.current?.focus(), 0);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValue('');
    };

    const saveBalance = async (dealer) => {
        const newVal = parseFloat(editValue);
        if (!Number.isFinite(newVal) || newVal < 0) { cancelEdit(); return; }
        setSavingId(dealer._id);
        try {
            const now = new Date();
            const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
            const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            const existingBal = Number(dealer.runningBalance ?? 0);
            // Preserve the sign (direction) of the old balance, just update magnitude
            const balanceType = existingBal >= 0 ? 'Dealer Owes Us' : 'We Owe Dealer';
            await api.post('/dealers/opening-balance', {
                dealerId: dealer._id,
                netBalance: newVal,
                balanceType,
                dealerType: dealer.dealerType || 'Dealer',
                date: dateStr,
                time: timeStr
            });
            await fetchDealers();
        } catch (err) {
            console.error('Failed to update balance:', err);
        } finally {
            setSavingId(null);
            setEditingId(null);
            setEditValue('');
        }
    };

    const fetchLineStockReceivables = async () => {
        setLineStockLoading(true);
        try {
            const { data } = await api.get('/line-stock/receivable');
            setLineStockRows(data?.data || []);
        } catch (error) {
            console.error('Error fetching line stock receivables:', error);
            setLineStockRows([]);
        } finally {
            setLineStockLoading(false);
        }
    };

    const fetchRecentTransactions = async () => {
        setTxnLoading(true);
        try {
            // Note: Reuse the dealer transactions endpoint with appropriate type filter
            const typeParam = mode === 'payable' ? 'Dealer' : 'Line Stocker';
            const { data } = await api.get(`/dealers/transactions?type=${typeParam}&page=${txnPage}&limit=10`);
            setRecentTxns(data?.data || []);
            setTxnTotalPages(data?.totalPages || 1);
        } catch (error) {
            console.error('Error fetching recent transactions:', error);
            setRecentTxns([]);
        } finally {
            setTxnLoading(false);
        }
    };

    const formatDateSafe = (dateStr) => {
        try {
            if (!dateStr) return '-';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return dateStr || '-'; }
    };

    const startLsEdit = (row) => {
        setLsEditingName(row.personName);
        setLsEditValue(String(Number(row.outstandingBalance ?? 0).toFixed(3)));
        setTimeout(() => lsEditInputRef.current?.focus(), 0);
    };

    const cancelLsEdit = () => {
        setLsEditingName(null);
        setLsEditValue('');
    };

    const saveLsBalance = async (row) => {
        const newVal = parseFloat(lsEditValue);
        if (!Number.isFinite(newVal) || newVal < 0) { cancelLsEdit(); return; }
        setLsSavingName(row.personName);
        try {
            const now = new Date();
            const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
            const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            await api.post('/dealers/opening-balance', {
                name: row.personName,
                phoneNumber: row.phoneNumber || '',
                netBalance: newVal,
                balanceType: 'Dealer Owes Us',
                dealerType: 'Line Stocker',
                date: dateStr,
                time: timeStr
            });
            // Update the local row's outstandingBalance optimistically
            setLineStockRows((prev) =>
                prev.map((r) =>
                    (r.personName || '').trim().toLowerCase() === (row.personName || '').trim().toLowerCase()
                        ? { ...r, outstandingBalance: newVal }
                        : r
                )
            );
        } catch (err) {
            console.error('Failed to update line stock balance:', err);
        } finally {
            setLsSavingName(null);
            setLsEditingName(null);
            setLsEditValue('');
        }
    };

    // --- Dealer rows: filter by mode and search ---
    const filteredDealers = useMemo(() => {
        return dealers.filter((d) => {
            const bal = Number(d.runningBalance ?? 0);

            // In receivable mode, only show regular Dealers in the first table.
            // Line Stockers are shown in the second table.
            if (mode === 'receivable' && d.dealerType === 'Line Stocker') return false;

            // In payable mode, we traditionally show negative balances.
            // In receivable mode, we show positive/zero balances.
            // Let's allow 0 balance in BOTH to avoid users "vanishing" after creation.
            const modeOk = mode === 'payable' ? bal <= 0 : bal >= 0;
            if (!modeOk) return false;
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
                (d.name || '').toLowerCase().includes(q) ||
                (d.phoneNumber || '').toLowerCase().includes(q)
            );
        });
    }, [dealers, mode, search]);

    // --- Line stock: deduplicated per person by API, already aggregated ---
    const groupedLineStock = useMemo(() => {
        if (!search.trim()) return lineStockRows;
        const q = search.toLowerCase();
        return lineStockRows.filter(
            (r) =>
                (r.personName || '').toLowerCase().includes(q) ||
                (r.phoneNumber || '').toLowerCase().includes(q)
        );
    }, [lineStockRows, search]);

    const heading = mode === 'payable' ? 'Debt Payable' : 'Debt Receivable';
    const emptyDealerMsg = mode === 'payable' ? 'No payable dealer debts found.' : 'No receivable dealer debts found.';

    const toCsvCell = (value) => {
        const str = String(value ?? '');
        return `"${str.replace(/"/g, '""')}"`;
    };
    const toExcelText = (value) => `'${String(value ?? '')}`;
    const formatGrams = (value) =>
        Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

    const handleExportCsv = () => {
        try {
            setExporting(true);

            const dealerHeader = ['S.No', 'Name', 'Phone No', 'Type', 'Balance (g)'];
            const dealerBodyRows = filteredDealers.map((d, idx) => [
                idx + 1,
                d.name || '-',
                toExcelText(d.phoneNumber || '-'),
                d.dealerType || 'Dealer',
                formatGrams(Math.abs(Number(d.runningBalance ?? 0)))
            ]);
            const dealerTotal = filteredDealers.reduce(
                (sum, d) => sum + Math.abs(Number(d.runningBalance ?? 0)),
                0
            );

            const csvLines = [];
            csvLines.push(toCsvCell('Dealer Balance'));
            csvLines.push(dealerHeader.map(toCsvCell).join(','));
            dealerBodyRows.forEach((row) => csvLines.push(row.map(toCsvCell).join(',')));
            csvLines.push(['TOTAL', '', '', formatGrams(dealerTotal)].map(toCsvCell).join(','));

            if (mode === 'receivable') {
                for (let i = 0; i < 3; i++) csvLines.push('');
                const lineHeader = ['S.No', 'Name', 'Phone No', 'Status', 'Balance (g)'];
                const lineBodyRows = groupedLineStock.map((r, idx) => [
                    idx + 1,
                    r.personName || '-',
                    toExcelText(r.phoneNumber || '-'),
                    r.status || '-',
                    Number(r.outstandingBalance ?? 0).toFixed(3)
                ]);
                const lineTotal = groupedLineStock.reduce(
                    (sum, r) => sum + Number(r.outstandingBalance ?? 0),
                    0
                );
                csvLines.push(toCsvCell('Line Stock Receivable'));
                csvLines.push(lineHeader.map(toCsvCell).join(','));
                lineBodyRows.forEach((row) => csvLines.push(row.map(toCsvCell).join(',')));
                csvLines.push(['TOTAL', '', '', '', lineTotal.toFixed(3)].map(toCsvCell).join(','));
            }

            const csv = csvLines.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            link.href = url;
            link.setAttribute('download', `${mode === 'payable' ? 'debt-payable' : 'debt-receivable'}-${stamp}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting CSV:', error);
        } finally {
            setExporting(false);
        }
    };

    const handleAddUser = async () => {
        setAddError('');
        const name = addForm.name.trim();
        const phoneNumber = addForm.phoneNumber.trim();
        const balance = parseFloat(addForm.balance);

        if (!name || !phoneNumber) {
            setAddError('Name and Phone Number are required.');
            return;
        }
        if (!Number.isFinite(balance) || balance < 0) {
            setAddError('Enter a valid balance (≥ 0).');
            return;
        }

        setAddSaving(true);
        try {
            const now = new Date();
            const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
            const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            await api.post('/dealers/opening-balance', {
                name,
                phoneNumber,
                netBalance: balance,
                balanceType: mode === 'payable' ? 'We Owe Dealer' : 'Dealer Owes Us',
                dealerType: addForm.dealerType,
                date: dateStr,
                time: timeStr
            });
            setShowAddUser(false);
            setAddForm({ name: '', phoneNumber: '', balance: '', dealerType: 'Dealer' });
            fetchDealers();
        } catch (err) {
            setAddError(err?.response?.data?.message || 'Failed to add user. Try again.');
        } finally {
            setAddSaving(false);
        }
    };

    const deleteRecord = async (id, row = null, isTransaction = false) => {
        setIsDeleting(true);
        try {
            if (isTransaction && id) {
                await api.delete(`/dealers/transactions/${id}`);
            } else if (id) {
                await api.delete(`/dealers/${id}`);
            } else if (row) {
                // Delete line stocks associated with this person
                await api.delete('/line-stock', {
                    params: {
                        personName: row.personName,
                        phoneNumber: row.phoneNumber || ''
                    }
                });

                // ALSO delete the dealer record if we have a dealerId for this line stock row
                if (row.dealerId && !id) {
                    await api.delete(`/dealers/${row.dealerId}`);
                }
            }

            await fetchDealers();
            fetchRecentTransactions();
            if (mode === 'receivable') {
                await fetchLineStockReceivables();
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
            const msg = error?.response?.data?.message || error.message || 'Failed to delete entry';
            alert(`Delete failed: ${msg}`);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="p-8 bg-gray-50/30 min-h-screen">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">{heading}</h1>
                    <p className="text-sm text-gray-500 mt-1">Dealer balances and line stock receivables</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {mode !== 'receivable' && !isReadOnly && (
                        <button
                            onClick={() => setShowAddUser(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#b8860b] hover:bg-[#8b6508] text-white font-bold text-sm transition-all shadow-lg shadow-[#b8860b33]"
                        >
                            <UserPlus size={16} />
                            Add User
                        </button>
                    )}
                    <button
                        onClick={handleExportCsv}
                        disabled={exporting || loading}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 font-bold text-sm hover:bg-gray-50 transition-all disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                        {exporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                </div>
            </div>

            {/* Global Search */}
            <div className="mb-6 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Search by name or phone number..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#b8860b33] transition-all text-sm"
                />
            </div>

            {/* Dealer Balance Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 bg-gray-900">
                    <h3 className="text-sm font-black text-yellow-400 uppercase tracking-[0.2em] text-center">
                        Dealer Balance
                    </h3>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/70">
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">S.No</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Name</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Phone No</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Type</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Balance (g)</th>
                                {!isReadOnly && <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-14">
                                        <div className="flex items-center justify-center gap-3 text-gray-400">
                                            <Loader2 className="animate-spin text-yellow-400" size={22} />
                                            <p className="font-bold text-sm">Fetching dealer balances...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredDealers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-14 text-center text-gray-400 font-bold">
                                        {search ? `No results for "${search}"` : emptyDealerMsg}
                                    </td>
                                </tr>
                            ) : (
                                filteredDealers.map((d, idx) => {
                                    const bal = Number(d.runningBalance ?? 0);
                                    return (
                                        <tr key={d._id || idx} className="hover:bg-gray-50/50 transition-all">
                                            <td className="px-4 py-4 font-black text-yellow-600 text-[11px]">{idx + 1}</td>
                                            <td className="px-4 py-4 font-black text-gray-900 text-[11px]">{d.name || '-'}</td>
                                            <td className="px-4 py-4 font-bold text-gray-500 text-[11px]">{d.phoneNumber || '-'}</td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border ${d.dealerType === 'Line Stocker'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                    : 'bg-blue-50 text-blue-700 border-blue-100'
                                                    }`}>
                                                    {d.dealerType || 'Dealer'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                {editingId === d._id ? (
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <input
                                                            ref={editInputRef}
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveBalance(d);
                                                                if (e.key === 'Escape') cancelEdit();
                                                            }}
                                                            onBlur={() => saveBalance(d)}
                                                            className="w-28 px-2 py-1.5 rounded-lg border-2 border-[#b8860b] text-right text-[12px] font-black focus:outline-none focus:ring-1 focus:ring-[#b8860b55]"
                                                        />
                                                        {savingId === d._id
                                                            ? <Loader2 size={14} className="animate-spin text-yellow-600" />
                                                            : <Check size={14} className="text-emerald-500 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); saveBalance(d); }} />
                                                        }
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`flex items-center justify-end gap-2 group ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                                                        onClick={() => !isReadOnly && startEdit(d)}
                                                        title={isReadOnly ? "" : "Click to edit"}
                                                    >
                                                        <span className={`font-black text-[12px] ${bal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {Math.abs(bal).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g
                                                        </span>
                                                        {!isReadOnly && <Pencil size={11} className="text-gray-300 group-hover:text-[#b8860b] transition-colors" />}
                                                    </div>
                                                )}
                                            </td>
                                            {!isReadOnly && (
                                                <td className="px-4 py-2 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate('/admin/dealers', { state: { dealerName: d.name } });
                                                            }}
                                                            className="p-2 text-gray-300 hover:text-blue-500 transition-colors"
                                                            title="Manage Dealer"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteRecord(d._id);
                                                            }}
                                                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {!loading && filteredDealers.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-900 border-t border-gray-700">
                                    <td colSpan={isReadOnly ? 4 : 5} className="px-4 py-3 text-[10px] font-black text-yellow-400 uppercase tracking-widest">Total</td>
                                    <td className="px-4 py-3 font-black text-yellow-400 text-[13px] text-right">
                                        {filteredDealers
                                            .reduce((sum, d) => sum + Math.abs(Number(d.runningBalance ?? 0)), 0)
                                            .toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Line Stock Receivable (receivable mode only) */}
            {
                mode === 'receivable' && (
                    <div className="mt-10 bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-800 bg-gray-900">
                            <h3 className="text-sm font-black text-yellow-400 uppercase tracking-[0.2em] text-center">
                                Line Stock Receivable
                            </h3>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/70">
                                        <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">S.No</th>
                                        <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Name</th>
                                        <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Phone No</th>
                                        <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                                        <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Balance (g)</th>
                                        {!isReadOnly && <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {lineStockLoading ? (
                                        <tr>
                                            <td colSpan="6" className="py-14">
                                                <div className="flex items-center justify-center gap-3 text-gray-400">
                                                    <Loader2 className="animate-spin text-yellow-400" size={22} />
                                                    <p className="font-bold text-sm">Fetching line stock receivables...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : groupedLineStock.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-14 text-center text-gray-400 font-bold">
                                                {search ? `No results for "${search}"` : 'No line stock receivables found.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        groupedLineStock.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50 transition-all">
                                                <td className="px-4 py-4 font-black text-yellow-600 text-[11px]">{idx + 1}</td>
                                                <td className="px-4 py-4 font-black text-gray-900 text-[11px]">{row.personName || '-'}</td>
                                                <td className="px-4 py-4 font-bold text-gray-500 text-[11px]">{row.phoneNumber || '-'}</td>
                                                <td className="px-4 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black border ${row.status === 'OVERDUE'
                                                        ? 'bg-red-50 text-red-700 border-red-200'
                                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                                        }`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 font-black text-[12px] text-right text-emerald-600">
                                                    {lsEditingName === row.personName ? (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <input
                                                                ref={lsEditInputRef}
                                                                type="number"
                                                                min="0"
                                                                step="0.001"
                                                                value={lsEditValue}
                                                                onChange={(e) => setLsEditValue(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') saveLsBalance(row);
                                                                    if (e.key === 'Escape') cancelLsEdit();
                                                                }}
                                                                onBlur={() => saveLsBalance(row)}
                                                                className="w-28 px-2 py-1.5 rounded-lg border-2 border-[#b8860b] text-right text-[12px] font-black focus:outline-none focus:ring-1 focus:ring-[#b8860b55]"
                                                            />
                                                            {lsSavingName === row.personName
                                                                ? <Loader2 size={14} className="animate-spin text-yellow-600" />
                                                                : <Check size={14} className="text-emerald-500 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); saveLsBalance(row); }} />
                                                            }
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className={`flex items-center justify-end gap-2 group ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                                                            onClick={() => !isReadOnly && startLsEdit(row)}
                                                            title={isReadOnly ? "" : "Click to edit balance"}
                                                        >
                                                            <span className={`font-black text-[12px] ${Number(row.outstandingBalance ?? 0) <= 0
                                                                ? 'text-green-600'
                                                                : row.status === 'OVERDUE'
                                                                    ? 'text-red-600'
                                                                    : 'text-emerald-600'
                                                                }`}>
                                                                {Number(row.outstandingBalance ?? 0).toFixed(3)} g
                                                            </span>
                                                            {!isReadOnly && <Pencil size={11} className="text-gray-300 group-hover:text-[#b8860b] transition-colors" />}
                                                        </div>
                                                    )}
                                                </td>
                                                {!isReadOnly && (
                                                    <td className="px-4 py-2 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigate('/admin/dealers', { state: { dealerName: row.personName } });
                                                                }}
                                                                className="p-2 text-gray-300 hover:text-blue-500 transition-colors"
                                                                title="Manage Dealer"
                                                            >
                                                                <Pencil size={16} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    deleteRecord(null, row);
                                                                }}
                                                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                                title="Delete User"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {!lineStockLoading && groupedLineStock.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-900 border-t border-gray-700">
                                            <td colSpan="4" className="px-4 py-3 text-[10px] font-black text-yellow-400 uppercase tracking-widest text-center">Total</td>
                                            <td className="px-4 py-3 font-black text-yellow-400 text-[13px] text-right">
                                                {groupedLineStock
                                                    .reduce((sum, r) => sum + Number(r.outstandingBalance ?? 0), 0)
                                                    .toFixed(3)} g
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div >
                )
            }

            {/* Recent Transactions History */}
            <div className="mt-10 bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 bg-gray-900">
                    <h3 className="text-sm font-black text-yellow-400 uppercase tracking-[0.2em] text-center">
                        Recent Transaction History
                    </h3>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/70">
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">S.No</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Type</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Name</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date / Time</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Product Details</th>
                                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Balance After</th>
                                {!isReadOnly && <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {txnLoading ? (
                                <tr>
                                    <td colSpan="7" className="py-14">
                                        <div className="flex items-center justify-center gap-3 text-gray-400">
                                            <Loader2 className="animate-spin text-yellow-400" size={22} />
                                            <p className="font-bold text-sm">Fetching history...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : recentTxns.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-14 text-center text-gray-400 font-bold">
                                        No recent transactions found.
                                    </td>
                                </tr>
                            ) : (
                                recentTxns.map((txn, idx) => {
                                    const bal = Number(txn.balanceAfter ?? 0);
                                    const isGold = mode === 'receivable';
                                    return (
                                        <tr key={txn._id || idx} className="hover:bg-gray-50/50 transition-all">
                                            <td className="px-4 py-4 font-black text-yellow-600 text-[11px]">
                                                {(txnPage - 1) * 10 + idx + 1}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border ${txn.transactionType === 'Line Stock Issuance' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    txn.transactionType === 'Line Stock Settlement' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        txn.transactionType === 'Dealer Purchase' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            'bg-gray-50 text-gray-600 border-gray-100'
                                                    }`}>
                                                    {txn.transactionType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-black text-gray-900 text-[11px] leading-tight">{txn.name}</p>
                                                <p className="text-[10px] font-bold text-gray-400">{txn.phoneNumber}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-gray-600 text-[11px] whitespace-nowrap">{formatDateSafe(txn.date)}</p>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{txn.time}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="space-y-1">
                                                    {(txn.items || []).slice(0, 2).map((item, i) => (
                                                        <p key={i} className="text-[10px] font-black text-gray-500 leading-none">
                                                            • {item.itemName} ({item.quantity || 1}x) - {item.netWeight?.toFixed(3)}g
                                                        </p>
                                                    ))}
                                                    {(txn.items || []).length > 2 && (
                                                        <p className="text-[9px] font-bold text-yellow-600 italic">
                                                            + {(txn.items.length - 2)} more items
                                                        </p>
                                                    )}
                                                    {(txn.items || []).length === 0 && (
                                                        <p className="text-[10px] font-bold text-gray-300 italic">No item details</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`px-4 py-4 font-black text-[12px] text-right ${bal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {isGold ? `${bal.toFixed(3)} g` : `₹${Math.abs(bal).toLocaleString('en-IN')}`}
                                            </td>
                                            {!isReadOnly && (
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => navigate('/admin/dealers', { state: { dealerName: txn.name } })}
                                                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                            title="Manage"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteRecord(txn._id, null, true)}
                                                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                            title="Delete Transaction"
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
                {/* Pagination Controls */}
                <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400">Page {txnPage} of {txnTotalPages}</span>
                    <div className="flex gap-2">
                        <button
                            disabled={txnPage === 1}
                            onClick={() => setTxnPage(prev => prev - 1)}
                            className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30 font-black"
                        >
                            {'<'}
                        </button>
                        <button
                            disabled={txnPage === txnTotalPages}
                            onClick={() => setTxnPage(prev => prev + 1)}
                            className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30 font-black"
                        >
                            {'>'}
                        </button>
                    </div>
                </div>
            </div >

            {/* Add User Modal */}
            {
                showAddUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-8 relative">
                            <button
                                onClick={() => { setShowAddUser(false); setAddError(''); setAddForm({ name: '', phoneNumber: '', balance: '', dealerType: 'Dealer' }); }}
                                className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 transition-colors"
                            >
                                <X size={22} />
                            </button>
                            <h2 className="text-xl font-black text-gray-900 mb-1">Add User</h2>
                            <p className="text-xs text-gray-500 mb-6">
                                {mode === 'payable'
                                    ? 'Add a person to whom we owe a balance.'
                                    : 'Add a person with an existing balance they owe us.'}
                            </p>

                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Name</label>
                                    <input
                                        type="text"
                                        placeholder="Full name"
                                        value={addForm.name}
                                        onChange={(e) => { setAddForm({ ...addForm, name: e.target.value }); setAddError(''); }}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">Phone Number</label>
                                    <input
                                        type="text"
                                        placeholder="Phone number"
                                        value={addForm.phoneNumber}
                                        onChange={(e) => { setAddForm({ ...addForm, phoneNumber: e.target.value }); setAddError(''); }}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">
                                        {mode === 'payable' ? 'Balance We Owe Them (g)' : 'Balance They Owe Us (g)'}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        placeholder="0.000"
                                        value={addForm.balance}
                                        onChange={(e) => setAddForm({ ...addForm, balance: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">User Type</label>
                                    <select
                                        value={addForm.dealerType}
                                        onChange={(e) => setAddForm({ ...addForm, dealerType: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] text-sm font-medium bg-white"
                                    >
                                        <option value="Dealer">Dealer</option>
                                        <option value="Line Stocker">Line Stocker</option>
                                    </select>
                                </div>
                                {addError && (
                                    <p className="text-xs text-red-600 font-bold bg-red-50 px-3 py-2 rounded-lg border border-red-100">{addError}</p>
                                )}
                                <button
                                    onClick={handleAddUser}
                                    disabled={addSaving}
                                    className="w-full py-3 rounded-xl bg-[#b8860b] hover:bg-[#8b6508] text-white font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-lg shadow-[#b8860b33]"
                                >
                                    {addSaving ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                                    {addSaving ? 'Saving...' : 'Add User'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
};

export default DealerDebtLedger;
