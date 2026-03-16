import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Info, User, Search, Trash2, Plus, X, Scale, Receipt, ShoppingBag } from 'lucide-react';
import { lineStockService } from '../../services/lineStockService';
import api from '../../axiosConfig';

const SettleLineStock = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [lineStock, setLineStock] = useState(null);
    const [issuedItems, setIssuedItems] = useState([]);
    const [receiptItems, setReceiptItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [previousBalance, setPreviousBalance] = useState(0);
    const [serialToSearch, setSerialToSearch] = useState('');
    const [goldRate, setGoldRate] = useState(0);

    useEffect(() => {
        fetchLineStock();
        fetchGoldRate();
    }, [id]);

    const fetchGoldRate = async () => {
        try {
            const res = await api.get('/gold-rate');
            if (res.data?.rate) setGoldRate(res.data.rate);
        } catch (error) {
            console.error('Error fetching gold rate:', error);
        }
    };

    const fetchLineStock = async () => {
        try {
            setLoading(true);
            setErrorMessage('');

            // 1. Fetch Line Stock Record
            const data = await lineStockService.getById(id);
            if (!data) throw new Error('Line Stock record not found');
            setLineStock(data);

            // 2. Initialize Issued Items from the record
            if (data.items) {
                setIssuedItems(
                    data.items.map((item) => ({
                        productId: item.productId?._id || item.productId,
                        productName: item.productName || item.productId?.itemName || 'Unknown Item',
                        serialNo: item.serialNo || item.productId?.serialNo || '-',
                        weight: item.weight || item.productId?.netWeight || 0,
                        issuedQty: item.issuedQty || 0,
                        soldQty: 0,
                        returnedQty: item.issuedQty || 0,
                        billNo: '',
                        soldWeight: 0
                    }))
                );
            }

            // 3. Set Total Running Balance for the person as Previous Balance
            if (data.personName) {
                try {
                    const res = await api.get('/line-stock/details', {
                        params: { name: data.personName.trim() }
                    });
                    if (res.data && typeof res.data.runningBalance !== 'undefined') {
                        setPreviousBalance(Number(res.data.runningBalance.toFixed(3)));
                    } else {
                        // Fallback to record-based initial balance if person not found
                        const currentRecValue = Number(data.totals?.manualValue ?? data.totals?.issued ?? 0);
                        const currentRecReturned = Number(data.totals?.returned ?? 0);
                        setPreviousBalance(Number((currentRecValue - currentRecReturned).toFixed(3)));
                    }
                } catch (err) {
                    console.error('Error fetching total balance:', err);
                    // Fallback to record-based initial balance
                    const currentRecValue = Number(data.totals?.manualValue ?? data.totals?.issued ?? 0);
                    const currentRecReturned = Number(data.totals?.returned ?? 0);
                    setPreviousBalance(Number((currentRecValue - currentRecReturned).toFixed(3)));
                }
            } else {
                // Fallback to record-based initial balance if no person name
                const currentRecValue = Number(data.totals?.manualValue ?? data.totals?.issued ?? 0);
                const currentRecReturned = Number(data.totals?.returned ?? 0);
                setPreviousBalance(Number((currentRecValue - currentRecReturned).toFixed(3)));
            }

        } catch (error) {
            console.error('Fetch error:', error);
            setErrorMessage(error.message || 'Failed to initialize settlement data');
        } finally {
            setLoading(false);
        }
    };

    const handleIssuedChange = (idx, field, val) => {
        const next = [...issuedItems];
        next[idx][field] = val;
        const issued = parseInt(next[idx].issuedQty, 10) || 0;
        const weight = parseFloat(next[idx].weight) || 0;

        if (field === 'soldQty') {
            const sold = Math.max(0, Math.min(issued, parseInt(val, 10) || 0));
            next[idx].soldQty = sold;
            next[idx].returnedQty = Math.max(0, issued - sold);
        }

        if (field === 'returnedQty') {
            const returned = Math.max(0, Math.min(issued, parseInt(val, 10) || 0));
            next[idx].returnedQty = returned;
            next[idx].soldQty = Math.max(0, issued - returned);
        }

        next[idx].soldWeight = Number((((parseInt(next[idx].soldQty, 10) || 0) * weight)).toFixed(3));

        setIssuedItems(next);
    };

    const addReceiptRow = () => {
        setReceiptItems([...receiptItems, {
            billNo: '',
            type: 'Pure Gold',
            weight: 0,
            cashAmount: 0,
            goldRate: goldRate,
            purity: 0
        }]);
    };

    const handleReceiptChange = (idx, field, val) => {
        const next = [...receiptItems];
        next[idx][field] = val;

        if (next[idx].type === 'Cash') {
            const amount = parseFloat(next[idx].cashAmount) || 0;
            const rate = parseFloat(next[idx].goldRate) || goldRate;
            next[idx].purity = rate > 0 ? Number((amount / rate).toFixed(3)) : 0;
        } else {
            const weight = parseFloat(next[idx].weight) || 0;
            next[idx].purity = Number(weight.toFixed(3));
        }

        setReceiptItems(next);
    };

    const handleRemoveReceipt = (idx) => {
        setReceiptItems(receiptItems.filter((_, i) => i !== idx));
    };

    const handleManualProductSearch = async () => {
        if (!serialToSearch.trim()) return;
        try {
            const { data } = await api.get(`/stock/serial/${serialToSearch.trim()}`);
            if (data) {
                if (issuedItems.some(i => i.productId === data._id)) {
                    setErrorMessage('Product already in the list');
                    return;
                }
                setIssuedItems(prev => [
                    ...prev,
                    {
                        productId: data._id,
                        productName: data.itemName,
                        serialNo: data.serialNo,
                        weight: data.netWeight || data.grossWeight || 0,
                        issuedQty: 0,
                        soldQty: 1,
                        returnedQty: 0,
                        billNo: '',
                        soldWeight: Number((parseFloat(data.netWeight || data.grossWeight || 0)).toFixed(3)),
                        isManual: true
                    }
                ]);
                setSerialToSearch('');
                setErrorMessage('');
            }
        } catch (error) {
            setErrorMessage('Product not found in inventory');
        }
    };

    const handleSettle = async () => {
        try {
            setSaving(true);
            setSuccessMessage('');
            setErrorMessage('');

            const payload = {
                issuedTransactions: issuedItems.map(item => ({
                    productId: item.productId,
                    soldQty: item.soldQty,
                    billNo: item.billNo
                })),
                receiptTransactions: receiptItems.map(rec => ({
                    billNo: rec.billNo,
                    type: rec.type,
                    weight: rec.weight,
                    cashAmount: rec.cashAmount,
                    goldRate: rec.goldRate
                }))
            };

            await api.put(`/line-stock/settle/${id}`, payload);
            setSuccessMessage('Settlement completed successfully!');
            setTimeout(() => navigate('/admin/line-stock'), 1500);
        } catch (error) {
            console.error('Settlement Error:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to complete settlement');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#fdfbf7] flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4"></div>
            <p className="text-amber-800 font-black uppercase tracking-widest text-xs">Readying Accounts...</p>
        </div>
    );

    if (!lineStock) return (
        <div className="min-h-screen bg-[#fdfbf7] flex flex-col items-center justify-center p-6 text-center">
            <X className="text-red-500 mb-6" size={48} />
            <h2 className="text-2xl font-black text-gray-800 mb-4 uppercase">Error Fetching Record</h2>
            <button onClick={() => navigate('/admin/line-stock')} className="bg-[#b8860b] text-white px-8 py-3 rounded-xl font-black uppercase shadow-lg">Return to List</button>
        </div>
    );

    const totalReceiptPurity = receiptItems.reduce((acc, item) => acc + (item.purity || 0), 0);
    const totalSoldWeight = issuedItems.reduce((acc, item) => acc + ((parseInt(item.soldQty) || 0) * (item.weight || 0)), 0);
    const totalReturnedWeight = issuedItems.reduce((acc, item) => acc + ((parseInt(item.returnedQty) || 0) * (item.weight || 0)), 0);
    const finalBalance = Number((previousBalance - totalSoldWeight - totalReceiptPurity).toFixed(3));

    return (
        <div className="p-6 bg-[#fdfbf7] min-h-screen">
            {/* Navigation Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/admin/line-stock')} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 hover:text-[#b8860b] transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-[0.2em] font-black mb-1">
                        <span>Line Stock Management</span> / <span className="text-amber-600">{lineStock.lineNumber}</span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight">Settle Line Stocker Account</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <ShoppingBag size={80} />
                        </div>
                        <div className="flex flex-col items-center text-center relative z-10">
                            <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-[#b8860b] mb-4 shadow-inner">
                                <User size={40} />
                            </div>
                            <h2 className="text-2xl font-black text-gray-800 mb-1">{lineStock.personName}</h2>
                            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-6">{lineStock.phoneNumber}</p>

                            <div className="w-full space-y-3">
                                <div className="bg-[#fcfaf5] p-5 rounded-2xl border border-amber-50 shadow-sm">
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 opacity-60 text-left">Previous Balance</p>
                                    <div className="flex items-end justify-between">
                                        <p className="text-3xl font-black text-amber-900 leading-none">{previousBalance.toFixed(3)}g</p>
                                        <span className="text-[10px] bg-amber-200/40 text-amber-700 px-2 py-1 rounded-md font-black uppercase">Debt</span>
                                    </div>
                                </div>
                                <div className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest ${lineStock.status === 'OVERDUE' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                    <Info size={14} /> {lineStock.status}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1e1e2d] text-white p-8 rounded-[2rem] shadow-xl relative group cursor-help">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <h4 className="text-xs font-black uppercase tracking-widest mb-3 text-amber-400">Quick Guide</h4>
                        <p className="text-gray-400 text-[11px] leading-relaxed font-bold">
                            Fill in sold and returned quantities. Sold grams reduce the balance. Returned quantity goes back to stock when the settlement is completed.
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-8">
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                            <div className="flex items-center gap-3">
                                <Scale className="text-amber-600" size={24} />
                                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Issued Products Details</h3>
                            </div>
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-amber-600 transition-colors" size={16} />
                                <input
                                    type="text"
                                    placeholder="Add item by serial..."
                                    className="pl-10 pr-6 py-2.5 text-xs rounded-2xl border border-gray-100 w-56 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all font-bold"
                                    value={serialToSearch}
                                    onChange={(e) => setSerialToSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleManualProductSearch()}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#fdfbf7] text-[#b8860b] text-[10px] uppercase font-black tracking-[0.15em] border-b border-gray-50">
                                    <tr>
                                        <th className="pl-8 pr-4 py-5">Item Name</th>
                                        <th className="px-4 py-5 text-center">Serial No</th>
                                        <th className="px-4 py-5 text-center font-bold">Weight (G)</th>
                                        <th className="px-4 py-5 text-center">Issued</th>
                                        <th className="px-4 py-5 text-center">Sold</th>
                                        <th className="px-4 py-5 text-center">Returned</th>
                                        <th className="px-4 py-5">Bill No</th>
                                        <th className="pr-8 pl-4 py-5 text-right font-bold">Sold Weight (g)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {issuedItems.map((item, idx) => (
                                        <tr key={idx} className="group hover:bg-[#fcfbf9]/50 transition-colors">
                                            <td className="pl-8 pr-4 py-5">
                                                <div className="font-black text-gray-800">{item.productName}</div>
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                <div className="px-3 py-1 bg-gray-100 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-widest inline-block">{item.serialNo}</div>
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                <div className="text-xs font-black text-amber-700">{item.weight.toFixed(3)}g</div>
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                <div className="text-[10px] font-black text-gray-400">{item.issuedQty}</div>
                                            </td>
                                            <td className="px-4 py-5">
                                                <input
                                                    type="number"
                                                    className="w-12 h-10 px-0 bg-blue-50 text-center rounded-xl border border-blue-100 focus:border-blue-400 focus:ring-0 text-xs font-black text-blue-900 transition-all font-bold"
                                                    value={item.soldQty}
                                                    onChange={(e) => handleIssuedChange(idx, 'soldQty', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-4 py-5">
                                                <input
                                                    type="number"
                                                    className="w-12 h-10 px-0 bg-amber-50 text-center rounded-xl border border-amber-100 focus:border-amber-400 focus:ring-0 text-xs font-black text-amber-900 transition-all font-bold"
                                                    value={item.returnedQty}
                                                    onChange={(e) => handleIssuedChange(idx, 'returnedQty', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-4 py-5">
                                                <input
                                                    type="text"
                                                    className="w-full min-w-[80px] h-10 px-3 bg-white border border-gray-100 rounded-xl focus:border-amber-300 focus:ring-0 text-[11px] font-bold"
                                                    placeholder="B-#"
                                                    value={item.billNo}
                                                    onChange={(e) => handleIssuedChange(idx, 'billNo', e.target.value)}
                                                />
                                            </td>
                                            <td className="pr-8 pl-4 py-5 text-right">
                                                <div className="font-black text-blue-600 text-sm">{(item.soldWeight || 0).toFixed(3)}g</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                            <div className="flex items-center gap-3">
                                <Receipt className="text-emerald-600" size={24} />
                                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Receipt & Payments Box</h3>
                            </div>
                            <button onClick={addReceiptRow} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all">
                                <Plus size={16} /> Add New Receipt
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#fdfbf7] text-emerald-600 text-[10px] uppercase font-black tracking-widest border-b border-gray-50">
                                    <tr>
                                        <th className="pl-8 pr-4 py-5">Bill No</th>
                                        <th className="px-4 py-5">Payment Type</th>
                                        <th className="px-4 py-5 text-right">Weight / Cash</th>
                                        <th className="px-4 py-5 text-center">Gold Rate</th>
                                        <th className="pr-8 pl-4 py-5 text-right font-black">Purity (g)</th>
                                        <th className="px-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {receiptItems.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-16 text-center text-gray-300 italic font-bold">No receipt entries recorded. Click "Add New Receipt" to start.</td>
                                        </tr>
                                    ) : receiptItems.map((rec, idx) => (
                                        <tr key={idx} className="hover:bg-emerald-50/10 transition-colors">
                                            <td className="pl-8 pr-4 py-5">
                                                <input
                                                    type="text"
                                                    className="w-full h-10 px-3 bg-white border border-gray-100 rounded-xl focus:border-emerald-300 focus:ring-0 text-[11px] font-bold"
                                                    placeholder="REC-#"
                                                    value={rec.billNo}
                                                    onChange={(e) => handleReceiptChange(idx, 'billNo', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-4 py-5">
                                                <select
                                                    className="w-full h-10 px-3 border border-gray-100 rounded-xl text-[11px] font-black bg-white focus:border-emerald-300 transition-all appearance-none text-gray-700"
                                                    value={rec.type}
                                                    onChange={(e) => handleReceiptChange(idx, 'type', e.target.value)}
                                                >
                                                    <option value="Pure Gold">Pure Gold (99.9)</option>
                                                    <option value="Other Jewellery">Old Gold / Jewelry</option>
                                                    <option value="Cash">Cash Payment</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-5 text-right">
                                                {rec.type === 'Cash' ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="text-[10px] font-black text-gray-300">₹</span>
                                                        <input
                                                            type="number"
                                                            className="w-28 h-10 px-3 bg-white border border-gray-100 rounded-xl text-right text-xs font-black focus:border-emerald-300"
                                                            value={rec.cashAmount}
                                                            onChange={(e) => handleReceiptChange(idx, 'cashAmount', e.target.value)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <input
                                                            type="number"
                                                            className="w-24 h-10 px-3 bg-white border border-gray-100 rounded-xl text-right text-xs font-black focus:border-emerald-300"
                                                            value={rec.weight}
                                                            onChange={(e) => handleReceiptChange(idx, 'weight', e.target.value)}
                                                        />
                                                        <span className="text-[10px] font-black text-gray-300">G</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                {rec.type === 'Cash' && (
                                                    <input
                                                        type="number"
                                                        className="w-24 h-10 px-3 bg-gray-50 text-center rounded-xl border border-gray-100 focus:border-emerald-300 text-xs font-black"
                                                        value={rec.goldRate}
                                                        onChange={(e) => handleReceiptChange(idx, 'goldRate', e.target.value)}
                                                    />
                                                )}
                                            </td>
                                            <td className="pr-8 pl-4 py-5 text-right">
                                                <p className="text-sm font-black text-emerald-600">-{rec.purity.toFixed(3)}g</p>
                                            </td>
                                            <td className="px-4 text-center">
                                                <button onClick={() => handleRemoveReceipt(idx)} className="text-gray-200 hover:text-red-500 transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-[#1e1e2d] rounded-[3rem] p-12 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 relative z-10">
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3">Previous Bal</p>
                                <p className="text-3xl font-black text-white leading-none">{previousBalance.toFixed(3)}g</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3">Sold (-)</p>
                                <p className="text-3xl font-black text-red-400 leading-none">-{Number(totalSoldWeight).toFixed(3)}g</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3">Receipts (-)</p>
                                <p className="text-3xl font-black text-emerald-400 leading-none">-{totalReceiptPurity.toFixed(3)}g</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] backdrop-blur-xl">
                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-3">Final Debt</p>
                                <p className="text-2xl font-black text-amber-400 leading-none tracking-tight">{finalBalance.toFixed(3)}g</p>
                            </div>
                        </div>

                        <div className="mt-16 pt-10 border-t border-gray-800 flex justify-end items-center gap-10 relative z-10">
                            <button onClick={() => navigate('/admin/line-stock')} className="text-gray-500 hover:text-white font-black uppercase tracking-widest text-xs transition-colors">Discard</button>
                            <button
                                onClick={handleSettle}
                                disabled={saving}
                                className="bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 text-gray-950 px-16 py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-amber-500/10 active:scale-95 flex items-center gap-3"
                            >
                                <CheckCircle size={20} strokeWidth={2.5} />
                                {saving ? 'Saving...' : 'Settle Account'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {errorMessage && (
                <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-red-600 text-white px-10 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 fade-in duration-500">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Info size={18} /></div>
                    <span className="font-black uppercase tracking-widest text-[10px]">{errorMessage}</span>
                    <button onClick={() => setErrorMessage('')} className="ml-6 opacity-40 hover:opacity-100 transition-opacity"><X size={18} /></button>
                </div>
            )}

            {successMessage && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-md"></div>
                    <div className="bg-white p-20 rounded-[4rem] text-center shadow-2xl relative z-10 scale-in-center">
                        <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                        <h3 className="text-4xl font-black text-gray-800 mb-4 uppercase">Account Settled</h3>
                        <p className="text-gray-400 font-bold mb-10">Transition completed successfully.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettleLineStock;
