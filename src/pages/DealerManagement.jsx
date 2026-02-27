import React, { useState, useEffect } from 'react';
import api from '../axiosConfig';
import {
    UserPlus,
    Plus,
    Minus,
    Calendar,
    Clock,
    Save,
    ChevronRight,
    Search,
    RefreshCw,
    ShoppingCart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DealerManagement = () => {
    const navigate = useNavigate();
    const [dealers, setDealers] = useState([]);
    const [dealerName, setDealerName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [totalGramPurchase, setTotalGramPurchase] = useState('');
    const [sriBill, setSriBill] = useState('');
    const [dealerPurchaseCost, setDealerPurchaseCost] = useState('');
    const [selectedDealerId, setSelectedDealerId] = useState('');
    const [selectedDealer, setSelectedDealer] = useState(null);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));

    // Balance and Type
    const [currentBalance, setCurrentBalance] = useState(0);
    const toThreeDecimals = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Number(parsed.toFixed(3)) : 0;
    };

    const userPurchaseCost = toThreeDecimals((toThreeDecimals(totalGramPurchase) * toThreeDecimals(sriBill)) / 100);
    const grossBalance = toThreeDecimals(toThreeDecimals(currentBalance) - userPurchaseCost + toThreeDecimals(dealerPurchaseCost));

    // Dynamic Items
    const [items, setItems] = useState([{
        serialNo: '',
        itemName: '',
        jewelName: '',
        jewelleryType: 'Gold',
        category: 'Necklace',
        designName: '',
        purity: '22K',
        grossWeight: '',
        netWeight: '',
        quantity: 1
    }]);

    const [loading, setLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchDealers();
        const timer = setInterval(() => {
            const now = new Date();
            setTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // Auto-clear message after 4 seconds
    useEffect(() => {
        if (!message) return;
        const t = setTimeout(() => setMessage(''), 4000);
        return () => clearTimeout(t);
    }, [message]);

    const fetchDealers = async () => {
        try {
            const res = await api.get('/dealers');
            setDealers(res.data.data);
        } catch (error) {
            console.error('Error fetching dealers:', error);
        }
    };

    const handleDealerNameChange = (e) => {
        const name = e.target.value;
        setDealerName(name);

        const dealer = dealers.find(d => d.name === name);
        if (dealer) {
            setSelectedDealerId(dealer._id);
            setSelectedDealer(dealer);
            setPhoneNumber(dealer.phoneNumber);
            setCurrentBalance(dealer.runningBalance);
        } else {
            setSelectedDealerId('');
            setSelectedDealer(null);
            setPhoneNumber('');
            setCurrentBalance(0);
        }
    };

    const handleAddItem = () => {
        setItems([...items, {
            serialNo: '',
            itemName: '',
            jewelName: '',
            jewelleryType: 'Gold',
            category: 'Necklace',
            designName: '',
            purity: '22K',
            grossWeight: '',
            netWeight: '',
            quantity: 1
        }]);
    };

    const handleRemoveItem = (index) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const handleCancelItem = (index) => {
        handleRemoveItem(index);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;

        // Logic: Gross and Net weight are same
        if (field === 'grossWeight' || field === 'netWeight') {
            newItems[index].grossWeight = value;
            newItems[index].netWeight = value;
        }

        setItems(newItems);

        // Auto-fetch if serialNo is entered
        if (field === 'serialNo' && value.length >= 3) {
            fetchItemDetails(index, value);
        }
    };

    const fetchItemDetails = async (index, serialNo) => {
        try {
            const res = await api.get(`/dealers/item/${serialNo}`);
            if (res.data.success) {
                const stock = res.data.data;
                const newItems = [...items];
                newItems[index] = {
                    ...newItems[index],
                    itemName: stock.itemName,
                    jewelName: stock.jewelName || stock.itemName || '',
                    jewelleryType: stock.jewelleryType,
                    category: stock.category,
                    designName: stock.designName,
                    purity: stock.purity,
                    grossWeight: stock.grossWeight,
                    netWeight: stock.netWeight
                };
                setItems(newItems);
            }
        } catch {
            // Silently ignore if not found
        }
    };

    const resetDealerPage = () => {
        const now = new Date();
        setDealerName('');
        setPhoneNumber('');
        setSelectedDealerId('');
        setSelectedDealer(null);
        setCurrentBalance(0);
        setTotalGramPurchase('');
        setSriBill('');
        setDealerPurchaseCost('');
        setDate(now.toISOString().split('T')[0]);
        setTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
        setItems([{
            serialNo: '',
            itemName: '',
            jewelName: '',
            jewelleryType: 'Gold',
            category: 'Necklace',
            designName: '',
            purity: '22K',
            grossWeight: '',
            netWeight: '',
            quantity: 1
        }]);
    };

    const submitDealerAction = async (actionType) => {
        if (!dealerName) {
            setMessage('⚠️ Please enter or select a dealer name before saving.');
            return;
        }

        const validItems = items
            .map((item) => ({
                ...item,
                serialNo: String(item.serialNo || '').trim(),
                itemName: String(item.itemName || '').trim(),
                jewelName: String(item.jewelName || item.itemName || '').trim(),
                quantity: parseInt(item.quantity, 10) || 0,
                grossWeight: parseFloat(item.grossWeight) || 0,
                netWeight: parseFloat(item.netWeight) || 0
            }))
            .filter((item) => item.serialNo && item.itemName && item.quantity > 0 && item.grossWeight > 0 && item.netWeight > 0);

        const effectiveActionType = actionType === 'stockOnly' && validItems.length === 0
            ? 'transactionOnly'
            : actionType;

        setLoading(true);
        setLoadingAction(effectiveActionType);
        try {
            const payload = {
                dealerId: selectedDealerId,
                dealerName: dealerName,
                phoneNumber: phoneNumber,
                items: validItems,
                date,
                time,
                currentBalance: toThreeDecimals(currentBalance),
                totalGramPurchase: toThreeDecimals(totalGramPurchase),
                sriBill: toThreeDecimals(sriBill),
                userPurchaseCost: toThreeDecimals(userPurchaseCost),
                dealerPurchaseCost: toThreeDecimals(dealerPurchaseCost),
                totalValue: toThreeDecimals(userPurchaseCost - toThreeDecimals(dealerPurchaseCost)),
                actionType: effectiveActionType
            };

            const res = await api.post('/dealers/stock-in', payload);
            setMessage(
                actionType === 'stockOnly' && effectiveActionType === 'transactionOnly'
                    ? 'No item rows found, so balance transaction was saved successfully.'
                    : (res.data?.message || 'Saved successfully!')
            );
            fetchDealers();

            if (effectiveActionType === 'stockOnly') {
                // Reset only stock entry rows after stock save
                setItems([{
                    serialNo: '',
                    itemName: '',
                    jewelName: '',
                    jewelleryType: 'Gold',
                    category: 'Necklace',
                    designName: '',
                    purity: '22K',
                    grossWeight: '',
                    netWeight: '',
                    quantity: 1
                }]);
            } else if (effectiveActionType === 'transactionOnly') {
                // Transaction save resets Dealer page to fresh state
                resetDealerPage();
            }
        } catch (error) {
            setMessage('Error: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
            setLoadingAction('');
        }
    };

    const handleSaveStockDetails = () => submitDealerAction('stockOnly');
    const handleSaveTransaction = () => submitDealerAction('transactionOnly');

    const handleB2BSalesRedirect = () => {
        const enteredName = String(dealerName || '').trim();
        const matchedDealer = selectedDealer || dealers.find(
            (d) => String(d.name || '').trim().toLowerCase() === enteredName.toLowerCase()
        );

        const finalName = matchedDealer?.name || enteredName;
        const finalPhone = matchedDealer?.phoneNumber || String(phoneNumber || '').trim();

        if (!finalName) {
            setMessage('⚠️ Please enter a dealer name before proceeding to sales.');
            return;
        }

        navigate('/admin/sales', {
            state: {
                saleType: 'B2B',
                customerDetails: {
                    name: finalName,
                    phone: finalPhone
                },
                date,
                time
            }
        });
    };

    return (
        <div className="p-6 bg-[#F8FAFC] min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dealers</h1>
                    <button
                        onClick={handleB2BSalesRedirect}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg shadow-sm transition-all"
                    >
                        <ShoppingCart size={18} />
                        Dealer Purchase Stock
                    </button>
                </div>
                <div className="flex items-center gap-4 text-sm font-medium text-gray-500 bg-white px-4 py-2 rounded-lg shadow-sm">
                    <div className="flex items-center gap-2 border-r pr-4">
                        <Clock size={16} className="text-yellow-500" />
                        {time}
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-yellow-500" />
                        {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-4">
                        <UserPlus size={20} className="text-yellow-600" />
                        <h2 className="font-bold text-gray-800 uppercase text-xs tracking-wider">Dealer Information</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Dealer Name</label>
                            <input
                                list="dealerList"
                                value={dealerName}
                                onChange={handleDealerNameChange}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm font-medium"
                                placeholder="Search or Enter New Dealer"
                            />
                            <datalist id="dealerList">
                                {dealers.map(d => (
                                    <option key={d._id} value={d.name} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Phone Number</label>
                            <input
                                type="text"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                readOnly={!!selectedDealerId}
                                className={`w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium ${!!selectedDealerId ? 'bg-gray-50 disabled:cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-yellow-400 outline-none'}`}
                                placeholder="+91 98765 43210"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Time</label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6 bg-gray-50/30 p-6 rounded-2xl border border-dashed border-gray-200">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Current Balance (g)</label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    step="0.001"
                                    value={currentBalance}
                                    onChange={(e) => setCurrentBalance(e.target.value)}
                                    className={`w-full pl-10 pr-20 py-4 bg-white border border-gray-200 rounded-2xl text-2xl font-bold focus:ring-4 focus:ring-yellow-400/20 outline-none transition-all ${toThreeDecimals(currentBalance) >= 0 ? 'text-green-500' : 'text-red-500'}`}
                                    placeholder="0.000"
                                />
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-300">g</span>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentBalance(Math.abs(toThreeDecimals(currentBalance)))}
                                        className={`w-6 h-6 rounded-md transition-all shadow-sm flex items-center justify-center ${toThreeDecimals(currentBalance) >= 0 ? 'bg-green-500 scale-110 shadow-green-200' : 'bg-green-100 hover:bg-green-200'}`}
                                        title="Dealer Owes Us (+)"
                                    >
                                        {toThreeDecimals(currentBalance) >= 0 && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentBalance(-Math.abs(toThreeDecimals(currentBalance)))}
                                        className={`w-6 h-6 rounded-md transition-all shadow-sm flex items-center justify-center ${toThreeDecimals(currentBalance) < 0 ? 'bg-red-500 scale-110 shadow-red-200' : 'bg-red-100 hover:bg-red-200'}`}
                                        title="We Owe Dealer (-)"
                                    >
                                        {toThreeDecimals(currentBalance) < 0 && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] mt-2 font-bold text-gray-400 uppercase tracking-widest">
                                {toThreeDecimals(currentBalance) >= 0 ? "Dealer Owes Us" : "We Owe Dealer"}
                            </p>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Total gram purchase (g)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.001"
                                    value={totalGramPurchase}
                                    onChange={(e) => setTotalGramPurchase(e.target.value)}
                                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl text-2xl font-bold text-gray-900 focus:ring-4 focus:ring-yellow-400/20 outline-none transition-all"
                                    placeholder="0.000"
                                />
                            </div>
                            <p className="text-[10px] mt-2 font-bold text-gray-400 uppercase tracking-widest">
                                Total Gram Purchase
                            </p>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3">SRI BILL (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.001"
                                    value={sriBill}
                                    onChange={(e) => setSriBill(e.target.value)}
                                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl text-2xl font-bold text-gray-900 focus:ring-4 focus:ring-yellow-400/20 outline-none transition-all"
                                    placeholder="0.000"
                                />
                            </div>
                            <p className="text-[10px] mt-2 font-bold text-gray-400 uppercase tracking-widest">
                                SRI Bill
                            </p>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Today purchase by user (g)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.001"
                                    value={userPurchaseCost}
                                    readOnly
                                    className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-2xl font-bold text-gray-700"
                                    placeholder="0.000"
                                />
                            </div>
                            <p className="text-[10px] mt-2 font-bold text-gray-400 uppercase tracking-widest text-right">
                                User Purchase Value
                            </p>
                        </div>
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Today purchase by dealer (g)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.001"
                                    value={dealerPurchaseCost}
                                    onChange={(e) => setDealerPurchaseCost(e.target.value)}
                                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl text-2xl font-bold text-gray-900 focus:ring-4 focus:ring-yellow-400/20 outline-none transition-all"
                                    placeholder="0.000"
                                />
                            </div>
                            <p className="text-[10px] mt-2 font-bold text-gray-400 uppercase tracking-widest text-right">
                                Dealer Purchase Value
                            </p>
                        </div>
                    </div>
                    <div className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${grossBalance >= 0
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'}`}>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 opacity-60">Calculated Gross Balance (g)</label>
                        <div className="text-4xl font-black flex items-center gap-2">{Math.abs(grossBalance).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</div>
                        <p className="text-sm font-bold mt-2 uppercase">
                            {grossBalance >= 0 ? "Dealer Owes Us" : "We Owe Dealer"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {items.map((item, index) => (
                    <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md">
                        <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-yellow-400 text-[10px] font-bold flex items-center justify-center">0{index + 1}</span>
                                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider">Item Details</h3>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* Basic Item Details */}
                            <div>
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                    <h4 className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Basic item Details</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Item Number</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={item.serialNo}
                                                onChange={(e) => handleItemChange(index, 'serialNo', e.target.value)}
                                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm font-medium"
                                                placeholder="ITM-99201"
                                            />
                                            <Search className="absolute right-3 top-3 text-gray-300 pointer-events-none" size={16} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Item Name</label>
                                        <input
                                            type="text"
                                            value={item.itemName}
                                            onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm font-medium"
                                            placeholder="Gold Choker"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Jewel Name</label>
                                        <input
                                            type="text"
                                            value={item.jewelName || ''}
                                            onChange={(e) => handleItemChange(index, 'jewelName', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm font-medium"
                                            placeholder="Antique Choker"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Jewellery Type</label>
                                        <select
                                            value={item.jewelleryType}
                                            onChange={(e) => handleItemChange(index, 'jewelleryType', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm font-medium appearance-none"
                                        >
                                            <option>Gold</option>
                                            <option>Silver</option>
                                            <option>Platinum</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Category</label>
                                        <select
                                            value={item.category}
                                            onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm font-medium"
                                        >
                                            <option>Necklace</option>
                                            <option>Ring</option>
                                            <option>Earrings</option>
                                            <option>Bangle</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Dealer Name</label>
                                        <input
                                            type="text"
                                            value={dealerName || ''}
                                            readOnly
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-500"
                                            placeholder="Automatic from dealer selection"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Weight & Quantity Details */}
                            <div>
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                    <h4 className="font-bold text-gray-400 uppercase text-[10px] tracking-widest">Weight and Quantity Details</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Gross Weight (G)</label>
                                        <input
                                            type="number"
                                            value={item.grossWeight}
                                            onChange={(e) => handleItemChange(index, 'grossWeight', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm font-medium"
                                            placeholder="0.000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Net Weight (G)</label>
                                        <input
                                            type="number"
                                            value={item.netWeight}
                                            onChange={(e) => handleItemChange(index, 'netWeight', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm font-medium"
                                            placeholder="0.000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Purity</label>
                                        <select
                                            value={item.purity}
                                            onChange={(e) => handleItemChange(index, 'purity', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm font-medium"
                                        >
                                            <option>24K</option>
                                            <option>22K</option>
                                            <option>18K</option>
                                            <option>916</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Quantity (Pieces)</label>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm font-medium"
                                            placeholder="1"
                                        />
                                    </div>
                                </div>

                                <div className="mt-8 pt-8 border-t border-gray-50 flex justify-end items-center gap-4">
                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => handleCancelItem(index)}
                                            className="flex items-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-all active:scale-95 text-xs"
                                        >
                                            <Minus size={16} />
                                            Cancel Item
                                        </button>
                                        {index === items.length - 1 && (
                                            <button
                                                type="button"
                                                onClick={handleAddItem}
                                                className="flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold rounded-xl shadow-lg shadow-yellow-200 transition-all active:scale-95 text-xs"
                                            >
                                                <Plus size={16} />
                                                Add Item
                                            </button>
                                        )}
                                        {index === items.length - 1 && (
                                            <button
                                                type="button"
                                                onClick={handleSaveStockDetails}
                                                disabled={loading}
                                                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 text-xs"
                                            >
                                                {loading && loadingAction === 'stockOnly' ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                                Save Stock Details
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {items.length === 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold rounded-xl shadow-lg shadow-yellow-200 transition-all active:scale-95 text-xs"
                        >
                            <Plus size={16} />
                            Add Item
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveStockDetails}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 text-xs"
                        >
                            {loading && loadingAction === 'stockOnly' ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                            Save Stock Details
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-8 flex justify-end gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <button
                    onClick={() => navigate('/admin/dashboard')}
                    className="px-8 py-3 bg-gray-50 text-gray-500 font-bold rounded-xl hover:bg-gray-100 transition-colors text-sm"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSaveTransaction}
                    disabled={loading}
                    className="flex items-center gap-2 px-8 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold rounded-xl shadow-lg shadow-yellow-200 transition-all active:scale-95 disabled:opacity-50 text-sm"
                >
                    {loading && loadingAction === 'transactionOnly' ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                    Save Transaction
                </button>
            </div>

            {message && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-300 ${message.includes('Error') || message.includes('⚠️')
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-green-50 border-green-200 text-green-700'
                    }`}>
                    <span>{message}</span>
                    <button onClick={() => setMessage('')} className="ml-2 text-current opacity-50 hover:opacity-100 transition-opacity font-black text-base leading-none">&times;</button>
                </div>
            )}
        </div>
    );
};

export default DealerManagement;
