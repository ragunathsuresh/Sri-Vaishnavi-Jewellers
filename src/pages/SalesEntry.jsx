
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import api from '../axiosConfig';
import {
    ChevronRight,
    Search,
    User,
    Phone,
    ArrowUpRight,
    ArrowDownLeft,
    Plus,
    Save,
    RotateCcw,
    Box,
    Loader2,
    Hash,
    Trash2,
    Clock,
    Calendar as CalendarIcon
} from 'lucide-react';

const SalesEntry = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const isEditMode = !!id;
    const [saleType, setSaleType] = useState(location.state?.saleType || 'B2C');
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({ type: '', message: '' });

    // Customer Details
    const [customer, setCustomer] = useState({
        name: location.state?.customerDetails?.name || '',
        phone: location.state?.customerDetails?.phone || '',
        lastTransaction: location.state?.customerDetails?.name ? 'Dealer Pre-filled' : 'No recent activity',
        date: location.state?.date || new Date().toISOString().split('T')[0],
        time: location.state?.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    });
    const [searchingCustomer, setSearchingCustomer] = useState(false);
    const [customerResults, setCustomerResults] = useState([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

    // Issued Items (Multi)
    const [issuedItems, setIssuedItems] = useState([{
        id: Date.now(),
        billNo: '',
        serialNo: '',
        itemName: '',
        jewelleryType: '',
        purity: '0.000',
        weight: '0.00',
        currentCount: 1,
        purchaseCount: 1,
        sriCost: '0',
        sriBill: '0',
        plus: '0',
        countError: '',
        suggestions: [],
        fetching: false
    }]);

    // Receipt Items (Multi)
    const [receiptItems, setReceiptItems] = useState([{
        id: Date.now() + 1,
        billNo: '',
        serialNo: 'REF-' + Math.floor(1000 + Math.random() * 9000),
        receiptType: 'Old Gold Exchange',
        customReceiptType: '',
        weight: '0.00',
        less: '0',
        purity: '0.000',
        actualTouch: '0',
        takenTouch: '0',
        currentCount: 1,
        purchaseCount: 1,
        amountReceived: '0.00'
    }]);

    // Committed Items (Memory Storage)
    const [committedIssuedItems, setCommittedIssuedItems] = useState([]);
    const [committedReceiptItems, setCommittedReceiptItems] = useState([]);

    useEffect(() => {
        if (isEditMode) {
            fetchSaleForEdit();
        } else if (location.state?.saleType) {
            setSaleType(location.state.saleType);
        }

        if (location.state?.customerDetails) {
            setCustomer((prev) => ({
                ...prev,
                name: location.state.customerDetails.name || '',
                phone: location.state.customerDetails.phone || '',
                lastTransaction: location.state.customerDetails.name ? 'Dealer Pre-filled' : prev.lastTransaction,
                date: location.state.date || prev.date,
                time: location.state.time || prev.time
            }));
        }
    }, [id, location.state]);

    const fetchSaleForEdit = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/sales/${id}`);
            const sale = data.data;
            setSaleType(sale.saleType || 'B2C');
            setCustomer({
                name: sale.customerDetails?.name || '',
                phone: sale.customerDetails?.phone || '',
                lastTransaction: 'Loaded from history',
                date: sale.date || '',
                time: sale.time || ''
            });
            // Map items to include an ID for React keys if missing
            const mapWithId = (items) => items.map(item => ({ ...item, id: item._id || Date.now() + Math.random() }));
            setCommittedIssuedItems(mapWithId(sale.issuedItems || []));
            setCommittedReceiptItems(mapWithId(sale.receiptItems || []));

            // Clear active entry rows
            setIssuedItems([{
                id: Date.now(),
                billNo: '',
                serialNo: '',
                itemName: '',
                jewelleryType: '',
                purity: '0.000',
                weight: '0.00',
                currentCount: 1,
                purchaseCount: 1,
                sriCost: '0',
                sriBill: '0',
                plus: '0',
                countError: '',
                suggestions: [],
                fetching: false
            }]);
            setReceiptItems([{
                id: Date.now() + 1,
                billNo: '',
                serialNo: 'REF-' + Math.floor(1000 + Math.random() * 9000),
                receiptType: 'Old Gold Exchange',
                customReceiptType: '',
                weight: '0.00',
                less: '0',
                purity: '0.000',
                actualTouch: '0',
                takenTouch: '0',
                currentCount: 1,
                purchaseCount: 1,
                amountReceived: '0.00'
            }]);
        } catch (error) {
            console.error('Error fetching sale:', error);
            showNotification('error', 'Failed to load sale for editing.');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    };

    // ITEM HANDLERS (ISSUED)
    const addIssuedItem = () => {
        setIssuedItems([...issuedItems, {
            id: Date.now(),
            billNo: '',
            serialNo: '',
            itemName: '',
            jewelleryType: '',
            purity: '0.000',
            weight: '0.00',
            currentCount: 1,
            purchaseCount: 1,
            sriCost: '0',
            sriBill: '0',
            plus: '0',
            countError: '',
            suggestions: [],
            fetching: false
        }]);
    };

    const removeIssuedItem = (id) => {
        setIssuedItems(prev => prev.filter(item => item.id !== id));
    };

    const handleIssuedChange = (id, field, value) => {
        const newItems = issuedItems.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };

                // Reset details when typing a new serial number to avoid stale data
                if (field === 'serialNo') {
                    updated.itemName = '';
                    updated.jewelleryType = '';
                    updated.purity = '0.000';
                    updated.weight = '0.00';
                    updated.currentCount = 0;
                    updated.purchaseCount = 1;
                    updated.sriCost = '0';
                    updated.sriBill = '0';
                    updated.plus = '0';
                    updated.countError = '';
                }

                // Plus (%) = SRI Bill (%) - SRI Cost (%)
                if (field === 'sriCost' || field === 'sriBill') {
                    const sriCost = parseFloat(field === 'sriCost' ? value : item.sriCost) || 0;
                    const sriBill = parseFloat(field === 'sriBill' ? value : item.sriBill) || 0;
                    updated.plus = (sriBill - sriCost).toFixed(3);
                }

                // Calculate Purity: weight * (plus / 100)
                if (field === 'weight' || field === 'sriCost' || field === 'sriBill') {
                    const weight = parseFloat(field === 'weight' ? value : item.weight) || 0;
                    const plus = parseFloat(updated.plus) || 0;
                    updated.purity = (weight * (plus / 100)).toFixed(3);
                }

                // Validation: Purchase Count vs Current Count
                if (field === 'purchaseCount') {
                    const purc = parseInt(value) || 0;
                    const curr = parseInt(item.currentCount) || 0;
                    if (purc > curr) {
                        updated.countError = "The count can't be exceed";
                    } else {
                        updated.countError = '';
                    }
                }

                if (field === 'serialNo' || field === 'itemName') {
                    debounceSearchStock(id, value);
                }
                return updated;
            }
            return item;
        });
        setIssuedItems(newItems);
    };

    // STOCK SUGGESTIONS
    const searchStockTimer = useRef({});
    const debounceSearchStock = (id, query) => {
        if (searchStockTimer.current[id]) clearTimeout(searchStockTimer.current[id]);
        if (!query || query.length < 2) {
            updateItemSuggestions(id, []);
            return;
        }

        searchStockTimer.current[id] = setTimeout(async () => {
            try {
                const { data } = await api.get(`/stock/search?query=${query}`);
                updateItemSuggestions(id, data.data || []);
            } catch (error) {
                console.error('Search error', error);
            }
        }, 400);
    };

    const updateItemSuggestions = (id, suggestions) => {
        setIssuedItems(prev => prev.map(item => item.id === id ? { ...item, suggestions } : item));
    };

    const fetchItemDetails = async (id, serialNo) => {
        const trimmedSerial = serialNo?.trim();
        if (!trimmedSerial) return;

        console.log(`[DEBUG] Fetching item details for serialNo: "${trimmedSerial}"`);

        // Skip if already fetching
        setIssuedItems(prev => prev.map(item => item.id === id ? { ...item, fetching: true } : item));

        try {
            const { data } = await api.get(`/stock/serial/${trimmedSerial}`);
            if (data.success && data.data) {
                const stock = data.data;
                setIssuedItems(prev => prev.map(item => item.id === id ? {
                    ...item,
                    serialNo: stock.serialNo,
                    itemName: stock.itemName,
                    jewelleryType: stock.jewelleryType,
                    purity: stock.purity,
                    weight: stock.netWeight || stock.grossWeight,
                    currentCount: stock.currentCount ?? stock.count ?? 0,
                    purchaseCount: 1, // Reset to 1 for new selection
                    suggestions: [],
                    fetching: false
                } : item));
                showNotification('success', `Fetched details for ${stock.itemName}`);
            } else {
                setIssuedItems(prev => prev.map(item => item.id === id ? {
                    ...item,
                    itemName: '',
                    jewelleryType: '',
                    purity: '0.000',
                    weight: '0.00',
                    currentCount: 0,
                    purchaseCount: 1,
                    fetching: false
                } : item));
                showNotification('error', 'Item number not found in stock.');
            }
        } catch (error) {
            console.error('Error fetching item details:', error);
            setIssuedItems(prev => prev.map(item => item.id === id ? {
                ...item,
                itemName: '',
                jewelleryType: '',
                purity: '0.000',
                weight: '0.00',
                currentCount: 0,
                purchaseCount: 1,
                fetching: false
            } : item));
            if (error.response?.status === 404) {
                showNotification('error', 'Item number not found.');
            }
        }
    };

    const selectStockSuggestion = (id, stock) => {
        setIssuedItems(prev => prev.map(item => item.id === id ? {
            ...item,
            serialNo: stock.serialNo,
            itemName: stock.itemName,
            jewelleryType: stock.jewelleryType,
            purity: stock.purity,
            weight: stock.netWeight || stock.grossWeight,
            currentCount: stock.currentCount ?? stock.count ?? 0,
            purchaseCount: 1,
            suggestions: []
        } : item));
    };

    // ITEM HANDLERS (RECEIPT)
    const addReceiptItem = () => {
        setReceiptItems([...receiptItems, {
            id: Date.now(),
            billNo: '',
            serialNo: 'REF-' + Math.floor(1000 + Math.random() * 9000),
            receiptType: 'Old Gold Exchange',
            customReceiptType: '',
            weight: '0.00',
            less: '0',
            actualTouch: '0',
            takenTouch: '0',
            purity: '0.000'
        }]);
    };

    const removeReceiptItem = (id) => {
        setReceiptItems(prev => prev.filter(item => item.id !== id));
    };

    const handleReceiptChange = (id, field, value) => {
        const newItems = receiptItems.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                // Recalculate Purity: (weight - less) * (takenTouch / 100)
                if (['weight', 'less', 'actualTouch', 'takenTouch'].includes(field)) {
                    const w = parseFloat(updated.weight) || 0;
                    const l = parseFloat(updated.less) || 0;
                    const tt = parseFloat(updated.takenTouch) || 0;
                    updated.purity = ((w - l) * (tt / 100)).toFixed(3);
                }
                return updated;
            }
            return item;
        });
        setReceiptItems(newItems);
    };

    const clearDraft = () => {
        setCommittedIssuedItems([]);
        setCommittedReceiptItems([]);
        showNotification('success', 'Draft cleared successfully!');
    };

    const justSelectedRef = useRef(false);

    // CUSTOMER SEARCH
    useEffect(() => {
        if (justSelectedRef.current) {
            justSelectedRef.current = false;
            return;
        }

        const delayDebounceFn = setTimeout(() => {
            if (customer.name.length > 2 || customer.phone.length > 2) {
                searchCustomers(customer.name || customer.phone);
            } else {
                setCustomerResults([]);
                setShowCustomerDropdown(false);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [customer.name, customer.phone]);

    const searchCustomers = async (query) => {
        setSearchingCustomer(true);
        try {
            const { data } = await api.get(`/sales/customer/search?query=${query}`);
            setCustomerResults(data.data);
            setShowCustomerDropdown(data.data.length > 0);
        } catch (error) {
            console.error('Error searching customers:', error);
        } finally {
            setSearchingCustomer(false);
        }
    };
    const handleSubmit = async (e, mode = 'all') => {
        if (e) e.preventDefault();

        // Basic validation
        if (!String(customer.name || '').trim() || !String(customer.phone || '').trim()) {
            showNotification('error', 'Please enter customer name and phone.');
            return;
        }

        if (mode === 'issue') {
            const validItems = issuedItems.filter(item => item.itemName || item.serialNo);
            if (validItems.length === 0) {
                showNotification('error', 'No valid issued items to save.');
                return;
            }

            const processed = validItems.map(item => ({
                ...item,
                weight: parseFloat(item.weight),
                currentCount: parseInt(item.currentCount) || 0,
                purchaseCount: parseInt(item.purchaseCount) || 1,
                sriCost: parseFloat(item.sriCost) || 0,
                sriBill: parseFloat(item.sriBill) || 0,
                plus: parseFloat(item.plus) || 0,
                paidAmount: parseFloat(item.paidAmount) || 0
            }));

            setCommittedIssuedItems([...committedIssuedItems, ...processed]);
            setIssuedItems([{
                id: Date.now(),
                billNo: '',
                serialNo: '',
                itemName: '',
                jewelleryType: '',
                purity: '0.000',
                weight: '0.00',
                currentCount: 1,
                purchaseCount: 1,
                sriCost: '0',
                sriBill: '0',
                plus: '0',
                countError: '',
                suggestions: [],
                fetching: false
            }]);
            showNotification('success', 'Issued items added to draft!');
            return;
        }

        if (mode === 'receipt') {
            const validItems = receiptItems.filter(item => parseFloat(item.weight) > 0);
            if (validItems.length === 0) {
                showNotification('error', 'No valid receipt items to save.');
                return;
            }
            const missingCustomType = validItems.some(item => item.receiptType === 'Other' && !String(item.customReceiptType || '').trim());
            if (missingCustomType) {
                showNotification('error', 'Please enter custom receipt type for items marked as Other.');
                return;
            }

            const processed = validItems.map(item => ({
                ...item,
                receiptType: item.receiptType === 'Other'
                    ? String(item.customReceiptType || '').trim()
                    : item.receiptType,
                weight: parseFloat(item.weight),
                less: parseFloat(item.less) || 0,
                actualTouch: parseFloat(item.actualTouch) || 0,
                takenTouch: parseFloat(item.takenTouch) || 0
            }));

            setCommittedReceiptItems([...committedReceiptItems, ...processed]);
            setReceiptItems([{
                id: Date.now() + 1,
                billNo: '',
                serialNo: 'REF-' + Math.floor(1000 + Math.random() * 9000),
                receiptType: 'Old Gold Exchange',
                customReceiptType: '',
                weight: '0.00',
                less: '0',
                purity: '0.000',
                actualTouch: '0',
                takenTouch: '0'
            }]);
            showNotification('success', 'Receipt items added to draft!');
            return;
        }

        // Final Permanent Save
        setLoading(true);
        try {
            // Combine active inputs with committed drafts
            const currentIssued = issuedItems.filter(item => item.itemName || item.serialNo).map(item => ({
                ...item,
                weight: parseFloat(item.weight),
                currentCount: parseInt(item.currentCount) || 0,
                purchaseCount: parseInt(item.purchaseCount) || 1,
                sriCost: parseFloat(item.sriCost) || 0,
                sriBill: parseFloat(item.sriBill) || 0,
                plus: parseFloat(item.plus) || 0,
                paidAmount: parseFloat(item.paidAmount) || 0
            }));

            const currentReceipt = receiptItems.filter(item => parseFloat(item.weight) > 0).map(item => ({
                ...item,
                receiptType: item.receiptType === 'Other'
                    ? String(item.customReceiptType || '').trim()
                    : item.receiptType,
                weight: parseFloat(item.weight),
                value: parseFloat(item.value) || 0,
                less: parseFloat(item.less) || 0,
                currentCount: parseInt(item.currentCount) || 1,
                purchaseCount: parseInt(item.purchaseCount) || 1,
                amountReceived: parseFloat(item.amountReceived) || 0
            }));

            const finalIssuedItems = [...committedIssuedItems, ...currentIssued];
            const finalReceiptItems = [...committedReceiptItems, ...currentReceipt];
            const missingCustomType = finalReceiptItems.some(item => item.receiptType === 'Other' && !String(item.customReceiptType || '').trim());
            if (missingCustomType) {
                showNotification('error', 'Please enter custom receipt type for items marked as Other.');
                setLoading(false);
                return;
            }

            if (finalIssuedItems.length === 0 && finalReceiptItems.length === 0) {
                showNotification('error', 'No items in draft or active list to save.');
                setLoading(false);
                return;
            }

            const saleData = {
                saleType,
                customerDetails: {
                    name: customer.name,
                    phone: customer.phone,
                    lastTransaction: customer.lastTransaction
                },
                date: String(customer.date || '').trim() || new Date().toISOString().split('T')[0],
                time: String(customer.time || '').trim() || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                issuedItems: finalIssuedItems,
                receiptItems: finalReceiptItems
            };

            if (isEditMode) {
                await api.put(`/sales/${id}`, saleData);
                showNotification('success', 'Transaction updated successfully!');
            } else {
                await api.post('/sales', saleData);
                showNotification('success', 'Transaction saved permanently!');
            }
            setTimeout(() => navigate('/admin/transactions'), 2000);
        } catch (error) {
            console.error('Submit error:', error);
            showNotification('error', error.response?.data?.message || 'Database connection error.');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="p-8 pb-40 bg-gray-50/30 min-h-screen">
            {notification.message && (
                <div className={`fixed top-8 right-8 z-50 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'
                    }`}>
                    <span className="font-bold">{notification.message}</span>
                </div>
            )}

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 mb-1">Advanced Sales Entry</h1>
                    <p className="text-gray-400 font-medium">Multi-product transactions with live stock sync</p>
                </div>
                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 divide-x divide-gray-100">
                    <button onClick={() => setSaleType('B2C')} className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${saleType === 'B2C' ? 'bg-yellow-400 text-gray-900 shadow-lg shadow-yellow-100' : 'text-gray-400 hover:text-gray-600'}`}><User size={18} /> B2C</button>
                    <button onClick={() => setSaleType('B2B')} className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${saleType === 'B2B' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:text-gray-600'}`}><Box size={18} /> B2B</button>
                </div>
            </div>

            {/* Customer Section */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 mb-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center text-yellow-600"><User size={24} /></div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Customer Information</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-3 relative">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Full Name / Search</label>
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                            <input type="text" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)} className="w-full bg-gray-50 border-2 border-transparent pl-12 pr-4 py-4 rounded-2xl outline-none focus:bg-white focus:border-yellow-200 transition-all font-bold placeholder:text-gray-300" placeholder="Type name..." />
                            {searchingCustomer && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-500 animate-spin" size={18} />}
                        </div>
                        {showCustomerDropdown && (
                            <div className="absolute z-30 top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                                {customerResults.map(res => (
                                    <button key={res.phone} onMouseDown={() => { justSelectedRef.current = true; setCustomer(prev => ({ ...prev, name: res.name, phone: res.phone, lastTransaction: `Last: ${new Date(res.lastTransaction).toLocaleDateString()}` })); setShowCustomerDropdown(false); setCustomerResults([]); }} className="w-full text-left px-6 py-4 hover:bg-yellow-50 flex items-center justify-between group transition-colors">
                                        <div><p className="font-bold text-gray-900 group-hover:text-yellow-700">{res.name}</p><p className="text-[11px] text-gray-400">{res.phone}</p></div>
                                        <ChevronRight size={16} className="text-gray-200 group-hover:text-yellow-400" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Phone Number</label>
                        <div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} /><input type="text" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="w-full bg-gray-50 border-2 border-transparent pl-12 pr-4 py-4 rounded-2xl outline-none focus:bg-white focus:border-yellow-200 font-bold" placeholder="Ph: +91..." /></div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Date & Time</label>
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input type="date" value={customer.date} onChange={(e) => setCustomer({ ...customer, date: e.target.value })} className="w-full bg-gray-50 border-2 border-transparent pl-12 pr-4 py-4 rounded-2xl outline-none focus:bg-white focus:border-yellow-200 font-bold text-sm" />
                            </div>
                            <div className="relative flex-1">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input type="time" value={customer.time} onChange={(e) => setCustomer({ ...customer, time: e.target.value })} className="w-full bg-gray-50 border-2 border-transparent pl-12 pr-4 py-4 rounded-2xl outline-none focus:bg-white focus:border-yellow-200 font-bold text-sm" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Issued Items Section */}
            <div className="mb-10">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3"><div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-white shadow-lg shadow-yellow-100"><ArrowUpRight size={20} /></div><h2 className="text-xl font-black text-gray-900 tracking-tight">Issued Products</h2></div>
                    <button onClick={addIssuedItem} className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-black transition-all shadow-xl shadow-gray-200"><Plus size={16} /> ADD ANOTHER ITEM</button>
                </div>

                <div className="space-y-4">
                    {issuedItems.map((item) => (
                        <div key={item.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400"></div>

                            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-5 items-end">
                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">BILL NO</label>
                                    <input type="text" value={item.billNo} onChange={(e) => handleIssuedChange(item.id, 'billNo', e.target.value)} className="w-full bg-gray-50 border border-transparent px-4 py-3 rounded-xl font-bold" />
                                </div>

                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">ITEM NO / SERIAL</label>
                                    <input
                                        type="text"
                                        value={item.serialNo}
                                        onChange={(e) => handleIssuedChange(item.id, 'serialNo', e.target.value)}
                                        onBlur={() => fetchItemDetails(item.id, item.serialNo)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                fetchItemDetails(item.id, item.serialNo);
                                            }
                                        }}
                                        className="w-full bg-gray-50 border border-transparent px-4 py-3 rounded-xl font-bold"
                                        placeholder="Enter item no"
                                    />
                                </div>

                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">ITEM NAME</label>
                                    <input type="text" value={item.itemName} onChange={(e) => handleIssuedChange(item.id, 'itemName', e.target.value)} className="w-full bg-gray-50 border border-transparent px-4 py-3 rounded-xl font-bold" readOnly={item.fetching} />
                                </div>

                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">WEIGHT (G)</label>
                                    <input type="number" value={item.weight} onChange={(e) => handleIssuedChange(item.id, 'weight', e.target.value)} className="w-full bg-gray-50 border border-transparent px-4 py-3 rounded-xl font-bold" />
                                </div>

                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">CURR COUNT</label>
                                    <input type="number" readOnly value={item.currentCount} className="w-full bg-gray-100 border border-transparent px-4 py-3 rounded-xl font-bold text-gray-400 cursor-not-allowed" />
                                </div>

                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest pl-1 flex justify-between">
                                        PURC COUNT
                                        {item.countError && <span className="text-red-500 animate-pulse">{item.countError}</span>}
                                    </label>
                                    <input
                                        type="number"
                                        value={item.purchaseCount}
                                        onChange={(e) => handleIssuedChange(item.id, 'purchaseCount', e.target.value)}
                                        className={`w-full border-2 px-4 py-3 rounded-xl font-black transition-all ${item.countError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}
                                    />
                                </div>

                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-yellow-600 uppercase tracking-widest pl-1 text-[8px]">SRI COST (%)</label>
                                    <input type="number" value={item.sriCost} onChange={(e) => handleIssuedChange(item.id, 'sriCost', e.target.value)} className="w-full bg-yellow-50/50 border border-yellow-100 px-4 py-3 rounded-xl font-black text-yellow-700" />
                                </div>

                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-yellow-600 uppercase tracking-widest pl-1 text-[8px]">SRI BILL (%)</label>
                                    <input type="number" value={item.sriBill} onChange={(e) => handleIssuedChange(item.id, 'sriBill', e.target.value)} className="w-full bg-yellow-50/50 border border-yellow-100 px-4 py-3 rounded-xl font-black text-yellow-700" />
                                </div>

                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-yellow-600 uppercase tracking-widest pl-1">PLUS (%)</label>
                                    <div className="relative">
                                        <input type="number" value={item.plus} readOnly className="w-full bg-yellow-100/60 border border-yellow-100 pl-3 pr-8 py-3 rounded-xl font-black text-yellow-700 cursor-not-allowed" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-yellow-600">%</span>
                                    </div>
                                </div>

                                <div className="space-y-2 lg:col-span-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">PURITY (W * P)</label>
                                    <div className="py-3 px-4 bg-gray-100 rounded-xl font-black text-gray-900 text-center">
                                        {item.purity}
                                    </div>
                                </div>

                                <div className="lg:col-span-2 flex justify-end">
                                    <button
                                        onClick={() => removeIssuedItem(item.id)}
                                        className="w-full lg:w-auto flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white px-6 py-3 rounded-2xl font-black text-[10px] transition-all border border-red-100 uppercase tracking-wider shadow-sm group-hover:shadow-md"
                                    >
                                        <Trash2 size={16} /> REMOVE ITEM
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {issuedItems.length === 0 && (
                        <div className="bg-white p-6 rounded-3xl border border-dashed border-gray-200 text-center">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">No issued item rows. Click "Add Another Item" to add issue entries.</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={() => handleSubmit(null, 'issue')}
                        disabled={loading}
                        className="flex items-center gap-3 bg-gray-900 text-white px-8 py-3.5 rounded-2xl font-black text-xs hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        ADD TO ISSUE DRAFT
                    </button>
                </div>
            </div >

            {/* Receipt Items Section */}
            <div className="mb-20">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-100"><ArrowDownLeft size={20} /></div><h2 className="text-xl font-black text-gray-900 tracking-tight">Receipt / Old Gold</h2></div>
                    <button onClick={addReceiptItem} className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-900 rounded-xl font-black text-sm hover:bg-gray-200 transition-all border border-gray-200"><Plus size={16} /> ADD ANOTHER RECEIPT</button>
                </div>

                <div className="space-y-4">
                    {receiptItems.map((item) => (
                        <div key={item.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>

                            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-5 items-end">
                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">BILL NO</label>
                                    <input type="text" value={item.billNo} onChange={(e) => handleReceiptChange(item.id, 'billNo', e.target.value)} className="w-full bg-gray-50 border border-transparent px-4 py-3 rounded-xl font-bold" />
                                </div>
                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">SERIAL</label>
                                    <input type="text" value={item.serialNo} onChange={(e) => handleReceiptChange(item.id, 'serialNo', e.target.value)} className="w-full bg-gray-50 border border-transparent px-4 py-3 rounded-xl font-bold" />
                                </div>
                                <div className="space-y-2 lg:col-span-4">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">RECEIPT TYPE</label>
                                    <select
                                        value={item.receiptType}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            handleReceiptChange(item.id, 'receiptType', value);
                                            if (value !== 'Other') {
                                                handleReceiptChange(item.id, 'customReceiptType', '');
                                            }
                                        }}
                                        className="w-full bg-gray-50 border border-transparent px-4 py-3 rounded-xl font-bold outline-none"
                                    >
                                        <option value="Kachcha">Kachcha</option>
                                        <option value="Old Gold Exchange">Old Gold Exchange</option>
                                        <option value="Repair Return">Repair Return</option>
                                        <option value="Purchase Return">Purchase Return</option>
                                        <option value="Other">Other (Manual)</option>
                                    </select>
                                </div>
                                {item.receiptType === 'Other' && (
                                    <div className="space-y-2 lg:col-span-2">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">OTHER TYPE</label>
                                        <input
                                            type="text"
                                            value={item.customReceiptType || ''}
                                            onChange={(e) => handleReceiptChange(item.id, 'customReceiptType', e.target.value)}
                                            className="w-full bg-gray-50 border border-transparent px-4 py-3 rounded-xl font-bold"
                                            placeholder="Enter custom receipt type"
                                        />
                                    </div>
                                )}
                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">WEIGHT</label>
                                    <input type="number" value={item.weight} onChange={(e) => handleReceiptChange(item.id, 'weight', e.target.value)} className="w-full bg-gray-50 border border-transparent px-4 py-3 rounded-xl font-bold" />
                                </div>
                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">LESS (G)</label>
                                    <input type="number" value={item.less} onChange={(e) => handleReceiptChange(item.id, 'less', e.target.value)} className="w-full bg-gray-50 border border-transparent px-4 py-3 rounded-xl font-bold" />
                                </div>

                                {/* Row 2 */}
                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-green-600 uppercase tracking-widest pl-1">ACT. TOUCH</label>
                                    <input type="number" value={item.actualTouch} onChange={(e) => handleReceiptChange(item.id, 'actualTouch', e.target.value)} className="w-full bg-green-50/50 border border-green-100 px-4 py-3 rounded-xl font-black text-green-700" />
                                </div>
                                <div className="space-y-2 lg:col-span-1">
                                    <label className="text-[9px] font-black text-green-600 uppercase tracking-widest pl-1">TAKEN (%)</label>
                                    <div className="relative">
                                        <input type="number" value={item.takenTouch} onChange={(e) => handleReceiptChange(item.id, 'takenTouch', e.target.value)} className="w-full bg-green-50/50 border border-green-100 pl-3 pr-8 py-3 rounded-xl font-black text-green-700" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-green-600">%</span>
                                    </div>
                                </div>
                                <div className="space-y-2 lg:col-span-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">PURITY (W-L * T)</label>
                                    <div className="py-3 px-4 bg-gray-100 rounded-xl font-black text-gray-900 text-center">{item.purity}</div>
                                </div>

                                <div className="hidden lg:block lg:col-span-2" />
                                <div className="lg:col-span-2 flex justify-end">
                                    <button
                                        onClick={() => removeReceiptItem(item.id)}
                                        className="w-full lg:w-auto flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white px-6 py-3 rounded-2xl font-black text-[10px] transition-all border border-red-100 uppercase tracking-wider shadow-sm"
                                    >
                                        <Trash2 size={16} /> REMOVE ITEM
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {receiptItems.length === 0 && (
                        <div className="bg-white p-6 rounded-3xl border border-dashed border-gray-200 text-center">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">No receipt rows. Click "Add Another Receipt" to add receipt entries.</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={() => handleSubmit(null, 'receipt')}
                        disabled={loading}
                        className="flex items-center gap-3 bg-emerald-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        ADD TO RECEIPT DRAFT
                    </button>
                </div>
            </div >

            {/* Bottom Actions */}
            <div className="mt-12 bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex gap-4">
                    <button onClick={() => navigate('/admin/dashboard')} className="px-8 py-4 rounded-2xl font-black text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest text-xs">EXIT FORM</button>
                    <button onClick={clearDraft} className="flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-red-500 hover:bg-red-50 transition-all uppercase tracking-widest text-xs border border-transparent hover:border-red-100"><RotateCcw size={16} /> CLEAR DRAFT</button>
                </div>

                <div className="flex flex-col items-end gap-2">
                    {(committedIssuedItems.length > 0 || committedReceiptItems.length > 0) && (
                        <div className="flex gap-3 mb-2">
                            {committedIssuedItems.length > 0 && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black">{committedIssuedItems.length} ISSUES READY</span>}
                            {committedReceiptItems.length > 0 && <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-black">{committedReceiptItems.length} RECEIPTS READY</span>}
                        </div>
                    )}
                    <button onClick={handleSubmit} disabled={loading} className="w-full md:w-auto flex items-center justify-center gap-4 bg-yellow-400 px-16 py-5 rounded-[1.5rem] font-black text-gray-900 shadow-2xl shadow-yellow-200 hover:shadow-yellow-400 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                        <span className="uppercase tracking-[0.1em] text-sm">SAVE TRANSACTION PERMANENTLY</span>
                    </button>
                </div>
            </div >
        </div >
    );
};

export default SalesEntry;
