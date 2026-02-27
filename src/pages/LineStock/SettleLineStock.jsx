import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Info, User, Search, Trash2, Plus, X, Package } from 'lucide-react';
import { lineStockService } from '../../services/lineStockService';
import api from '../../axiosConfig';

const SettleLineStock = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [lineStock, setLineStock] = useState(null);
    const [settlementData, setSettlementData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [dealerBalance, setDealerBalance] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [availableStock, setAvailableStock] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [serialToSearch, setSerialToSearch] = useState('');

    useEffect(() => {
        fetchLineStock();
    }, [id]);

    const fetchLineStock = async () => {
        try {
            setLoading(true);
            const [data, dealersRes] = await Promise.all([
                lineStockService.getById(id),
                api.get('/dealers?type=Line Stocker')
            ]);
            setLineStock(data);
            setSettlementData(
                (data.items || []).map((item) => ({
                    productId: item.productId?._id || item.productId,
                    productName: item.productName,
                    issuedQty: item.issuedQty,
                    soldQty: item.soldQty || 0,
                    returnedQty: item.issuedQty - (item.soldQty || 0),
                    price: item.productId?.sellingPrice || 0,
                    grossWeight: parseFloat(item.productId?.grossWeight) || 0,
                    value: Number(item.totalReturnedValue || 0)
                }))
            );
            // Match dealer balance by person name
            const dealers = dealersRes.data?.data || [];
            const nameKey = (data.personName || '').trim().toLowerCase();
            const matched = dealers.find((d) => (d.name || '').trim().toLowerCase() === nameKey);
            setDealerBalance(matched ? matched.runningBalance : null);
        } catch (error) {
            console.error('Error fetching line stock:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSoldQtyChange = (idx, val) => {
        const soldQty = parseInt(val, 10) || 0;
        const next = [...settlementData];
        if (soldQty > next[idx].issuedQty) {
            setErrorMessage('Sold quantity cannot exceed issued quantity');
            return;
        }
        setErrorMessage('');
        next[idx].soldQty = soldQty;
        const returnedQty = next[idx].issuedQty - soldQty;
        next[idx].returnedQty = returnedQty;
        // Auto-calculate value in grams from returned qty × gross weight per unit
        const gw = parseFloat(next[idx].grossWeight) || 0;
        next[idx].value = Number((returnedQty * gw).toFixed(3));
        setSettlementData(next);
    };

    const handleSettle = async () => {
        try {
            setSaving(true);
            setSuccessMessage('');
            setErrorMessage('');
            const updatedLineStock = await lineStockService.settle(id, {
                items: settlementData.map((item) => ({
                    productId: item.productId,
                    issuedQty: item.issuedQty,
                    soldQty: item.soldQty,
                    value: Number(item.value) || 0
                }))
            });
            const priceByProductId = settlementData.reduce((acc, item) => {
                acc[String(item.productId)] = Number(item.price || 0);
                return acc;
            }, {});
            setLineStock(updatedLineStock);
            setSettlementData(
                (updatedLineStock.items || []).map((item) => ({
                    productId: item.productId?._id || item.productId,
                    productName: item.productName,
                    issuedQty: item.issuedQty,
                    soldQty: item.soldQty || 0,
                    returnedQty: item.returnedQty ?? (item.issuedQty - (item.soldQty || 0)),
                    price: priceByProductId[String(item.productId?._id || item.productId)] || 0,
                    value: Number(item.totalReturnedValue || 0)
                }))
            );
            setSuccessMessage('Line stock settled successfully');
            navigate('/admin/line-stock');
        } catch (error) {
            console.error('Error settling line stock:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to settle line stock');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-20 text-center text-[#b8860b] font-bold">Loading settlement details...</div>;
    }
    if (!lineStock) {
        return <div className="p-20 text-center">Line stock record not found.</div>;
    }

    const totalSold = settlementData.reduce((acc, item) => acc + item.soldQty, 0);
    const totalReturned = settlementData.reduce((acc, item) => acc + item.returnedQty, 0);
    const totalValue = settlementData.reduce((acc, item) => acc + (Number(item.value) || 0), 0);

    const handleValueChange = (idx, val) => {
        const next = [...settlementData];
        const numericValue = val === '' ? '' : Number(val);
        if (numericValue !== '' && (!Number.isFinite(numericValue) || numericValue < 0)) {
            return;
        }
        next[idx].value = numericValue;
        setSettlementData(next);
    };

    const handleSearchProduct = async () => {
        if (!serialToSearch.trim()) return;
        setSearchLoading(true);
        try {
            const { data } = await api.get(`/stock/history/${serialToSearch.trim()}`);
            if (data.success && data.data) {
                const product = data.data;
                // Check if already in settlementData
                if (settlementData.some(item => item.productId === product._id)) {
                    setErrorMessage('Product already added');
                    return;
                }

                setSettlementData(prev => [
                    ...prev,
                    {
                        productId: product._id,
                        productName: product.itemName,
                        issuedQty: 0,
                        soldQty: 0,
                        returnedQty: 0,
                        price: product.sellingPrice || 0,
                        grossWeight: parseFloat(product.grossWeight) || 0,
                        value: 0,
                        isManual: true
                    }
                ]);
                setSerialToSearch('');
                setErrorMessage('');
            }
        } catch (error) {
            console.error('Error searching product:', error);
            setErrorMessage('Product not found in inventory');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleIssuedQtyChange = (idx, val) => {
        const issuedQty = parseInt(val, 10) || 0;
        const next = [...settlementData];
        next[idx].issuedQty = issuedQty;
        // Recalculate returned
        const returnedQty = issuedQty - (next[idx].soldQty || 0);
        next[idx].returnedQty = Math.max(0, returnedQty);

        const gw = parseFloat(next[idx].grossWeight) || 0;
        next[idx].value = Number((next[idx].returnedQty * gw).toFixed(3));
        setSettlementData(next);
    };

    const handleRemoveItem = (idx) => {
        setSettlementData(settlementData.filter((_, i) => i !== idx));
    };

    return (
        <div className="p-6 bg-[#fdfbf7] min-h-screen">
            {successMessage && (
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                    {successMessage}
                </div>
            )}
            {errorMessage && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {errorMessage}
                </div>
            )}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/admin/line-stock')}
                    className="p-2 bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 hover:text-[#b8860b] transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">
                        <span>Line Stock</span>
                        <span>/</span>
                        <span className="text-[#b8860b]">{lineStock.lineNumber}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">Settle Line Stock</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-[#b8860b] mb-4">
                                <User size={40} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 mb-1">{lineStock.personName}</h2>
                            <p className="text-sm text-gray-400 mb-4">{lineStock.phoneNumber}</p>
                            <div
                                className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border mb-6 ${lineStock.status === 'OVERDUE'
                                    ? 'bg-red-50 text-red-600 border-red-100'
                                    : 'bg-blue-50 text-blue-600 border-blue-100'
                                    }`}
                            >
                                {lineStock.status}
                            </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-gray-50 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400 font-bold uppercase text-[10px]">Issued Date</span>
                                <span className="font-bold text-gray-700">
                                    {lineStock.issuedDate ? new Date(lineStock.issuedDate).toLocaleDateString() : 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400 font-bold uppercase text-[10px]">Due Date</span>
                                <span className="font-bold text-gray-700">
                                    {lineStock.expectedReturnDate ? new Date(lineStock.expectedReturnDate).toLocaleDateString() : 'N/A'}
                                </span>
                            </div>
                            {dealerBalance !== null && (
                                <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-bold flex flex-col gap-0.5 ${Number(dealerBalance) >= 0
                                    ? 'bg-green-50 text-green-700 border border-green-100'
                                    : 'bg-red-50 text-red-700 border border-red-100'
                                    }`}>
                                    <span className="uppercase tracking-wider opacity-70 text-[10px]">Current Balance</span>
                                    <span className="text-base font-black">{Number(dealerBalance).toFixed(3)} g</span>
                                    <span className="opacity-60 text-[10px]">{Number(dealerBalance) >= 0 ? 'Dealer Owes Us' : 'We Owe Dealer'}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl">
                        <div className="flex gap-3 text-amber-800">
                            <Info size={20} className="shrink-0" />
                            <p className="text-xs leading-relaxed font-medium">
                                Please enter the sold quantities for each item. Remaining items will be automatically marked as returned to main stock.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-8">
                    <div className="grid grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-transform hover:scale-105">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Sold</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-gray-800">{totalSold}</span>
                                <span className="text-xs text-gray-400">units</span>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-transform hover:scale-105">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Returned</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-gray-800">{totalReturned}</span>
                                <span className="text-xs text-gray-400">units</span>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-transform hover:scale-105">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Value (g)</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-gray-800">{Number(totalValue).toFixed(3)}</span>
                                <span className="text-xs text-gray-400">g</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Manual Product Search Section */}
                        <div className="p-8 border-b border-gray-50 bg-amber-50/30 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#b8860b] text-white rounded-lg">
                                    <Plus size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-800 uppercase tracking-tight text-sm">Add Product Details</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Enter item No to manually add products sold or returned</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Item No (e.g. SV-001)"
                                        className="w-64 pl-10 pr-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-[#b8860b33] focus:outline-none transition-all font-bold text-sm bg-white"
                                        value={serialToSearch}
                                        onChange={(e) => setSerialToSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchProduct()}
                                    />
                                </div>
                                <button
                                    onClick={handleSearchProduct}
                                    disabled={searchLoading}
                                    className="px-6 py-3 bg-[#b8860b] hover:bg-[#8b6508] disabled:bg-gray-200 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-md active:scale-95 flex items-center gap-2"
                                >
                                    {searchLoading ? 'Searching...' : 'Add Item'}
                                </button>
                            </div>
                        </div>

                        <table className="w-full text-left">
                            <thead className="bg-[#fdfbf7] border-b border-gray-50 text-[#b8860b] uppercase text-[10px] font-black tracking-widest">
                                <tr>
                                    <th className="px-8 py-5">Product Details</th>
                                    <th className="px-6 py-5">Issued</th>
                                    <th className="px-6 py-5">Sold (Edit)</th>
                                    <th className="px-6 py-5">Returned</th>
                                    <th className="px-6 py-5">Value (g)</th>
                                    <th className="px-6 py-5">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {settlementData.map((item, idx) => (
                                    <tr key={idx} className="group hover:bg-[#fcfaf5] transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="font-black text-gray-800">{item.productName}</div>
                                            {item.isManual && (
                                                <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase font-black tracking-widest border border-indigo-100 mt-1 inline-block">Manual Entry</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-6 font-bold text-gray-700">
                                            {item.isManual || (lineStock.items && lineStock.items[idx]?.issuedQty === 0) ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.issuedQty}
                                                    onChange={(e) => handleIssuedQtyChange(idx, e.target.value)}
                                                    className="w-20 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-black text-gray-800 text-center"
                                                />
                                            ) : (
                                                <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-black inline-block">
                                                    {item.issuedQty}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-6">
                                            <input
                                                type="number"
                                                min="0"
                                                max={item.issuedQty}
                                                value={item.soldQty}
                                                onChange={(e) => handleSoldQtyChange(idx, e.target.value)}
                                                className="w-20 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#b8860b] font-black text-gray-800 text-center"
                                            />
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-lg text-xs font-black inline-block">
                                                {item.returnedQty}
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 font-bold text-gray-700">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.001"
                                                value={item.value}
                                                onChange={(e) => handleValueChange(idx, e.target.value)}
                                                placeholder="0.000"
                                                className="w-28 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#b8860b] font-black text-gray-800 text-right"
                                            />
                                            <span className="ml-1 text-xs text-gray-400 font-bold">g</span>
                                        </td>
                                        <td className="px-6 py-6">
                                            {item.isManual && (
                                                <button
                                                    onClick={() => handleRemoveItem(idx)}
                                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="p-8 bg-[#fdfbf7] border-t border-gray-50 flex justify-end">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => navigate('/admin/line-stock')}
                                    className="px-8 py-4 rounded-2xl text-gray-400 font-black uppercase tracking-widest hover:text-gray-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSettle}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-10 py-4 bg-[#b8860b] hover:bg-[#8b6508] disabled:bg-gray-200 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-[#b8860b33]"
                                >
                                    {saving ? (
                                        'Saving...'
                                    ) : (
                                        <>
                                            Complete Settlement <CheckCircle size={18} strokeWidth={3} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettleLineStock;
