import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { lineStockService, stockService } from '../../services/lineStockService';
import api from '../../axiosConfig';
import { Search, User, Phone, Calendar, Package, Trash2, Plus, ArrowLeft, ArrowRight } from 'lucide-react';

const CreateLineStock = () => {
    const navigate = useNavigate();
    const [personDetails, setPersonDetails] = useState({
        personName: '',
        phoneNumber: '',
        issuedDate: new Date().toISOString().split('T')[0],
        expectedReturnDate: '',
        totalGram: '',
        currentBalance: null
    });
    const [dealerBalanceMap, setDealerBalanceMap] = useState({});

    const [availableStock, setAvailableStock] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [personSuggestions, setPersonSuggestions] = useState([]);
    const [savedPeople, setSavedPeople] = useState([]);
    const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);

    useEffect(() => {
        fetchStock();
        fetchSavedPeople();
    }, []);

    const fetchStock = async () => {
        try {
            const data = await stockService.getAll();
            setAvailableStock(data);
        } catch (error) {
            console.error('Error fetching stock:', error);
        }
    };

    const fetchSavedPeople = async () => {
        try {
            const [lineStockData, dealersRes] = await Promise.all([
                lineStockService.getAll({ limit: 1000 }),
                api.get('/dealers?type=Line Stocker')
            ]);
            const lineStocks = lineStockData?.lineStocks || [];
            const dealers = dealersRes.data?.data || [];

            // Build a balance map keyed by lowercased name
            const balMap = {};
            dealers.forEach((d) => {
                const key = (d.name || '').trim().toLowerCase();
                if (key) balMap[key] = d.runningBalance ?? 0;
            });
            setDealerBalanceMap(balMap);

            const map = new Map();
            lineStocks.forEach((record) => {
                const key = `${(record.personName || '').trim().toLowerCase()}::${(record.phoneNumber || '').trim()}`;
                if (!key || key === '::') return;
                if (!map.has(key)) {
                    map.set(key, {
                        personName: record.personName || '',
                        phoneNumber: record.phoneNumber || ''
                    });
                }
            });

            setSavedPeople(Array.from(map.values()));
        } catch (error) {
            console.error('Error fetching saved person details:', error);
        }
    };

    const handlePersonNameChange = (value) => {
        setPersonDetails({ ...personDetails, personName: value });
        if (!value.trim()) {
            setPersonSuggestions([]);
            setShowPersonSuggestions(false);
            return;
        }

        const query = value.trim().toLowerCase();
        const matches = savedPeople
            .filter((person) => (person.personName || '').toLowerCase().includes(query))
            .slice(0, 6);
        setPersonSuggestions(matches);
        setShowPersonSuggestions(matches.length > 0);
    };

    const handleSelectPerson = (person) => {
        const nameKey = (person.personName || '').trim().toLowerCase();
        const balance = dealerBalanceMap.hasOwnProperty(nameKey) ? dealerBalanceMap[nameKey] : null;
        setPersonDetails((prev) => ({
            ...prev,
            personName: person.personName || '',
            phoneNumber: person.phoneNumber || prev.phoneNumber,
            currentBalance: balance
        }));
        setShowPersonSuggestions(false);
    };

    const handleAddItem = (productId) => {
        const product = availableStock.find(p => p._id === productId);
        if (!product) return;

        if (selectedItems.some(item => item.productId === productId)) {
            alert('Product already added');
            return;
        }

        setSelectedItems([...selectedItems, {
            productId: product._id,
            productName: product.itemName,
            category: product.category,
            availableQty: product.currentCount,
            issuedQty: 1,
            price: product.sellingPrice || 0,
            grossWeight: parseFloat(product.grossWeight) || 0
        }]);
    };

    // Auto-calculate totalGram whenever selectedItems changes
    useEffect(() => {
        const computed = selectedItems.reduce(
            (sum, item) => sum + (parseFloat(item.grossWeight) || 0) * (parseInt(item.issuedQty) || 0),
            0
        );
        setPersonDetails((prev) => ({
            ...prev,
            totalGram: computed > 0 ? Number(computed.toFixed(3)) : prev.totalGram
        }));
    }, [selectedItems]);

    const handleUpdateQty = (idx, qty) => {
        const newItems = [...selectedItems];
        if (qty > newItems[idx].availableQty) {
            alert(`Only ${newItems[idx].availableQty} units available`);
            return;
        }
        newItems[idx].issuedQty = parseInt(qty) || 0;
        setSelectedItems(newItems);
    };

    const handleRemoveItem = (idx) => {
        setSelectedItems(selectedItems.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        if (!personDetails.personName || !personDetails.phoneNumber || !personDetails.expectedReturnDate) {
            alert('Please fill all person details');
            return;
        }
        if (selectedItems.length === 0) {
            alert('Please add at least one product');
            return;
        }

        try {
            setLoading(true);
            setSuccessMessage('');
            await lineStockService.create({
                ...personDetails,
                items: selectedItems.map(item => ({
                    productId: item.productId,
                    issuedQty: item.issuedQty
                })),
                totalValue: Number(personDetails.totalGram) || 0
            });
            setSuccessMessage('Line stock issued successfully');
            navigate('/admin/line-stock');
        } catch (error) {
            console.error('Error creating line stock:', error);
            alert(error.response?.data?.message || 'Failed to issue stock');
        } finally {
            setLoading(false);
        }
    };

    const filteredStock = availableStock.filter(p =>
        (p.itemName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (p.serialNo?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const totalQty = selectedItems.reduce((acc, item) => acc + item.issuedQty, 0);

    return (
        <div className="p-6 bg-[#fdfbf7] min-h-screen">
            {successMessage && (
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                    {successMessage}
                </div>
            )}
            {/* Breadcrumb & Navigation */}
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
                        <span className="text-[#b8860b]">Issue New Items</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">Create Line Stock</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Person Details Card */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                <User size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800">Person Details</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Sales Person Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="text"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-[#b8860b33] focus:outline-none transition-all"
                                        placeholder="Enter full name"
                                        value={personDetails.personName}
                                        onChange={(e) => handlePersonNameChange(e.target.value)}
                                        onFocus={() => {
                                            if (personSuggestions.length > 0) setShowPersonSuggestions(true);
                                        }}
                                        onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 120)}
                                    />
                                    {showPersonSuggestions && (
                                        <div className="absolute z-40 left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                                            {personSuggestions.map((person, idx) => (
                                                <button
                                                    key={`${person.personName}-${person.phoneNumber}-${idx}`}
                                                    type="button"
                                                    onMouseDown={() => handleSelectPerson(person)}
                                                    className="w-full text-left px-4 py-3 hover:bg-[#fdfbf7] transition-colors border-b last:border-b-0 border-gray-50"
                                                >
                                                    <div className="font-semibold text-gray-800">{person.personName}</div>
                                                    <div className="text-xs text-gray-400">{person.phoneNumber}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {personDetails.currentBalance !== null && (
                                    <div className={`mt-1 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 ${Number(personDetails.currentBalance) >= 0
                                        ? 'bg-green-50 text-green-700 border border-green-100'
                                        : 'bg-red-50 text-red-700 border border-red-100'
                                        }`}>
                                        <span className="uppercase tracking-wider opacity-70">Current Balance:</span>
                                        <span>{Number(personDetails.currentBalance).toFixed(3)} g</span>
                                        <span className="opacity-60">({Number(personDetails.currentBalance) >= 0 ? 'Dealer Owes Us' : 'We Owe Dealer'})</span>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="tel"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-[#b8860b33] focus:outline-none transition-all"
                                        placeholder="+91 00000 00000"
                                        value={personDetails.phoneNumber}
                                        onChange={(e) => setPersonDetails({ ...personDetails, phoneNumber: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <Package size={16} className="text-[#b8860b]" />
                                    Total Weight to Issue (g)
                                </label>
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-amber-800 font-medium">Issue Value:</span>
                                        <span className="text-lg font-black text-amber-900">{personDetails.totalGram || '0.000'} g</span>
                                    </div>
                                    {personDetails.currentBalance !== null && (
                                        <>
                                            <div className="flex justify-between items-center mb-2 pt-2 border-t border-amber-200/50">
                                                <span className="text-sm text-amber-800 font-medium">Past Balance:</span>
                                                <span className="text-sm font-bold text-gray-600">{Number(personDetails.currentBalance).toFixed(3)} g</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-2 border-t-2 border-amber-300">
                                                <span className="text-sm text-indigo-800 font-black uppercase tracking-wider">Total Balance:</span>
                                                <span className="text-xl font-black text-indigo-900">
                                                    {(Number(personDetails.totalGram || 0) + Number(personDetails.currentBalance)).toFixed(3)} g
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-400 italic">This is the total gram amount that will be added to the person's debt.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Issued Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="date"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-[#b8860b33] focus:outline-none transition-all"
                                        value={personDetails.issuedDate}
                                        onChange={(e) => setPersonDetails({ ...personDetails, issuedDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Expected Return</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="date"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-[#b8860b33] focus:outline-none transition-all"
                                        value={personDetails.expectedReturnDate}
                                        onChange={(e) => setPersonDetails({ ...personDetails, expectedReturnDate: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Add Products Card */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[400px]">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                    <Package size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800">Add Products</h2>
                            </div>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#b8860b33]"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-gray-50">
                                        {filteredStock.length === 0 ? (
                                            <div className="p-4 text-center text-gray-400 text-sm">No items found</div>
                                        ) : filteredStock.map(p => (
                                            <div
                                                key={p._id}
                                                onClick={() => { handleAddItem(p._id); setSearchTerm(''); }}
                                                className="p-4 flex justify-between items-center hover:bg-[#fdfbf7] cursor-pointer group transition-colors"
                                            >
                                                <div>
                                                    <div className="font-bold text-gray-800 group-hover:text-[#b8860b] transition-colors">{p.itemName}</div>
                                                    <div className="text-xs text-gray-400">{p.serialNo} • {p.category}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-gray-800">{p.currentCount} units</div>
                                                    <div className="text-xs text-[#b8860b]">Available</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Selected Items Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50">
                                    <tr>
                                        <th className="py-4 font-bold">Product Name</th>
                                        <th className="py-4 font-bold">Category</th>
                                        <th className="py-4 font-bold">Stock</th>
                                        <th className="py-4 font-bold">Issue Qty</th>
                                        <th className="py-4 text-right pr-4 font-bold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {selectedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-20 text-center text-gray-300 italic">
                                                No products added yet. Use the search bar to find and add products.
                                            </td>
                                        </tr>
                                    ) : selectedItems.map((item, idx) => (
                                        <tr key={idx} className="group hover:bg-gray-50 transition-colors">
                                            <td className="py-4 pr-4">
                                                <div className="font-bold text-gray-800">{item.productName}</div>
                                            </td>
                                            <td className="py-4">
                                                <span className="px-2 py-1 bg-[#fdfbf7] text-[#b8860b] border border-[#b8860b33] rounded-md text-[10px] uppercase font-black">
                                                    {item.category}
                                                </span>
                                            </td>
                                            <td className="py-4">
                                                <div className="text-sm font-bold text-gray-600">{item.availableQty} units</div>
                                            </td>
                                            <td className="py-4">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.issuedQty}
                                                    onChange={(e) => handleUpdateQty(idx, e.target.value)}
                                                    className="w-20 px-3 py-1.5 rounded-lg border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] font-bold text-gray-800"
                                                />
                                            </td>
                                            <td className="py-4 text-right pr-4">
                                                <button
                                                    onClick={() => handleRemoveItem(idx)}
                                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Summary Sidebar */}
                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 sticky top-6">
                        <h3 className="text-xl font-black text-gray-800 mb-6 uppercase tracking-wider">Summary</h3>
                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Total Products</span>
                                <span className="font-black text-gray-800">{selectedItems.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Total Quantity</span>
                                <span className="font-black text-gray-800">{totalQty} Units</span>
                            </div>
                            <div className="space-y-2">
                                <label className="text-gray-400 font-bold uppercase tracking-widest text-[10px] block">Total Gram (g)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={personDetails.totalGram}
                                    onChange={(e) => setPersonDetails({ ...personDetails, totalGram: e.target.value })}
                                    placeholder="0.000"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#b8860b33] font-bold text-gray-800"
                                />
                            </div>
                        </div>
                        <div className="pt-6 border-t border-dashed border-gray-100 space-y-4">
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 bg-[#b8860b] hover:bg-[#8b6508] disabled:bg-gray-200 text-white py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-[#b8860b33]"
                            >
                                {loading ? 'Processing...' : (
                                    <>
                                        Submit Line Stock <Plus size={18} strokeWidth={3} />
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => navigate('/admin/line-stock')}
                                className="w-full text-center text-gray-400 font-bold text-sm uppercase tracking-widest hover:text-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>

                    <div className="bg-[#b8860b] text-white p-8 rounded-3xl shadow-lg relative overflow-hidden group">
                        <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <Package size={200} strokeWidth={1} />
                        </div>
                        <div className="relative z-10">
                            <h4 className="text-sm font-black uppercase tracking-widest mb-2">Need Help?</h4>
                            <p className="text-amber-100 text-xs leading-relaxed font-medium">
                                Once submitted, items will be officially issued to the sales person and deducted from main stock.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateLineStock;
