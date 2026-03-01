
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, ArrowLeft, Save, X } from 'lucide-react';
import api from '../axiosConfig';
import { useDevice } from '../context/DeviceContext';

const AddNewStock = () => {
    const { isReadOnly } = useDevice();
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const queryParams = new URLSearchParams(location.search);
    const isExistingMode = queryParams.get('mode') === 'existing';
    const isEditMode = !!id;

    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [itemNoSearch, setItemNoSearch] = useState('');
    const [notification, setNotification] = useState({ type: '', message: '' });
    const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [formData, setFormData] = useState({
        itemCode: '',
        itemName: '',
        jewelleryType: '',
        category: '',
        designName: '',
        supplierName: '',
        grossWeight: '',
        netWeight: '',
        purity: '22K (916)',
        currentQuantity: '0',
        newQuantity: '1'
    });

    const [categories, setCategories] = useState(['Necklace', 'Bangle', 'Ring', 'Earring']);

    useEffect(() => {
        if (isEditMode) {
            fetchStockForEdit();
        }
    }, [id]);

    // Auto-search 700ms after user stops typing Item Number
    useEffect(() => {
        if (isEditMode) return; // skip in edit mode
        const code = formData.itemCode.trim();
        if (!code) return;
        const timer = setTimeout(() => {
            handleSearchItem(code);
        }, 700);
        return () => clearTimeout(timer);
    }, [formData.itemCode]);

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    };

    const fetchStockForEdit = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/stock/${id}`);
            const stock = data.data;
            setFormData({
                itemCode: stock.serialNo || '',
                itemName: stock.itemName || '',
                jewelleryType: stock.jewelleryType || '',
                category: stock.category || '',
                designName: stock.designName || '',
                supplierName: stock.supplierName || '',
                grossWeight: (stock.grossWeight || 0).toString(),
                netWeight: (stock.netWeight || 0).toString(),
                purity: stock.purity || '22K (916)',
                currentQuantity: String(stock.currentCount ?? 0),
                newQuantity: '0' // In edit mode, we might just be editing details
            });
            // Add category if not in predefined list
            if (stock.category && !categories.includes(stock.category)) {
                setCategories(prev => [...prev.filter(c => c !== 'ADD_NEW'), stock.category]);
            }
        } catch (error) {
            console.error('Error fetching stock for edit:', error);
            showNotification('error', 'Failed to fetch stock item details.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'category' && value === 'ADD_NEW') {
            setIsAddingNewCategory(true);
            return;
        }

        // When item number changes, clear all other fields so stale data doesn't persist
        if (name === 'itemCode') {
            setFormData({
                itemCode: value,
                itemName: '',
                jewelleryType: '',
                category: '',
                designName: '',
                supplierName: '',
                grossWeight: '',
                netWeight: '',
                purity: '22K (916)',
                currentQuantity: '0',
                newQuantity: '1'
            });
            return;
        }

        setFormData(prev => {
            const newData = { ...prev, [name]: value };
            // Auto-calculate Net Weight
            if (name === 'grossWeight') {
                newData.netWeight = parseFloat(value).toFixed(3);
            }
            return newData;
        });
    };

    const handleSearchItem = async (codeToSearch) => {
        const targetCode = codeToSearch || itemNoSearch || formData.itemCode;
        if (!targetCode) return;

        setSearchLoading(true);
        try {
            const { data } = await api.get(`/stock/history/${targetCode}`);
            if (data.success && data.data) {
                const existingItem = data.data;
                setFormData({
                    ...formData,
                    itemCode: existingItem.serialNo || targetCode,
                    itemName: existingItem.itemName || '',
                    jewelleryType: existingItem.jewelleryType || '',
                    category: existingItem.category || '',
                    designName: existingItem.designName || '',
                    supplierName: existingItem.supplierName || '',
                    grossWeight: (existingItem.grossWeight || 0).toString(),
                    netWeight: (existingItem.netWeight || 0).toString(),
                    purity: existingItem.purity || '22K (916)',
                    currentQuantity: String(existingItem.currentCount ?? 0),
                    newQuantity: '0'
                });

                // Add category if not in predefined list
                if (existingItem.category && !categories.includes(existingItem.category)) {
                    setCategories(prev => [...prev.filter(c => c !== 'ADD_NEW'), existingItem.category, 'ADD_NEW']);
                }

                showNotification('success', 'Details loaded from history!');
            }
        } catch (error) {
            console.error('Error searching item:', error);
            if (error.response?.status === 404) {
                // Not found = new item, clear all details (keep itemCode)
                setFormData(prev => ({
                    itemCode: prev.itemCode,
                    itemName: '',
                    jewelleryType: '',
                    category: '',
                    designName: '',
                    supplierName: '',
                    grossWeight: '',
                    netWeight: '',
                    purity: '22K (916)',
                    currentQuantity: '0',
                    newQuantity: '1'
                }));
            } else {
                showNotification('error', 'Error searching for historical data.');
            }
        } finally {
            setSearchLoading(false);
        }
    };


    const handleAddNewCategory = () => {
        if (newCategoryName.trim()) {
            setCategories(prev => [...prev, newCategoryName.trim()]);
            setFormData(prev => ({ ...prev, category: newCategoryName.trim() }));
            setNewCategoryName('');
            setIsAddingNewCategory(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Duplicate serial number check (only for new stock, not edit mode)
            if (!isEditMode) {
                try {
                    const checkRes = await api.get(`/stock/history/${formData.itemCode}`);
                    if (checkRes.data.success && checkRes.data.data) {
                        showNotification('error', `Item Number "${formData.itemCode}" already exists. Each stock must have a unique Item Number.`);
                        setLoading(false);
                        return;
                    }
                } catch (checkErr) {
                    // 404 means not found = serial is available, continue
                    if (checkErr.response?.status !== 404) {
                        showNotification('error', 'Could not verify Item Number uniqueness. Try again.');
                        setLoading(false);
                        return;
                    }
                }
            }

            const stockData = {
                serialNo: formData.itemCode,
                itemName: formData.itemName,
                jewelleryType: formData.jewelleryType,
                category: formData.category,
                designName: formData.designName,
                supplierName: formData.supplierName,
                purchaseInvoiceNo: formData.purchaseInvoiceNo || '',
                grossWeight: parseFloat(formData.grossWeight),
                netWeight: parseFloat(formData.netWeight),
                purity: formData.purity,
                currentCount: parseInt(formData.newQuantity) || 0,
                purchaseCount: parseInt(formData.newQuantity) || 0,
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
            };

            if (isEditMode) {
                await api.put(`/stock/${id}`, stockData);
                showNotification('success', 'Stock updated successfully!');
            } else {
                await api.post('/stock', stockData);
                showNotification('success', 'Stock saved in "Stock management page"');
            }
            setTimeout(() => navigate('/admin/stock'), 2000);
        } catch (error) {
            console.error('Error adding stock:', error);
            const errorMsg = error.response?.data?.message || 'Failed to add stock item. Please check if Item Code is unique.';
            showNotification('error', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Notification Banner */}
            {notification.message && (
                <div className={`fixed top-8 right-8 z-50 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' :
                    notification.type === 'info' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                        'bg-red-50 border-red-100 text-red-700'
                    }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${notification.type === 'success' ? 'bg-green-100' :
                        notification.type === 'info' ? 'bg-blue-100' :
                            'bg-red-100'
                        }`}>
                        {notification.type === 'success' ? <Save size={18} /> :
                            notification.type === 'info' ? <ChevronRight size={18} /> :
                                <X size={18} />}
                    </div>
                    <span className="font-bold">{notification.message}</span>
                </div>
            )}
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-[13px] font-medium text-gray-400 mb-6">
                <Link to="/admin/dashboard" className="hover:text-yellow-600 transition-colors">Home</Link>
                <ChevronRight size={14} />
                <Link to="/admin/stock" className="hover:text-yellow-600 transition-colors">Stock Management</Link>
                <ChevronRight size={14} />
                <span className="text-gray-900 font-bold">{isEditMode ? 'Edit Stock' : 'Add New Stock'}</span>
            </nav>

            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 mb-1">
                        {isEditMode ? 'Edit Stock Item' : (isExistingMode ? 'Add Existing Stock' : 'Add New Stock')}
                    </h1>
                    <p className="text-gray-400 font-medium">
                        {isEditMode ? 'Modify existing stock details' : (isExistingMode ? 'Search and select an item from existing inventory' : 'Enter new jewellery stock details into inventory')}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/admin/stock')}
                    className="flex items-center gap-2 bg-white border border-gray-100 px-5 py-2.5 rounded-xl font-bold text-gray-600 shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                    <ArrowLeft size={18} />
                    Back to Stock Management
                </button>
            </div>

            <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} className="space-y-8">
                {isExistingMode && (
                    <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-100 flex items-center gap-4 mb-8">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={itemNoSearch}
                                onChange={(e) => setItemNoSearch(e.target.value)}
                                placeholder="Enter Item No or Serial No to search..."
                                className="w-full bg-white border border-yellow-200 px-6 py-3.5 rounded-xl outline-none focus:ring-4 focus:ring-yellow-50 transition-all font-bold text-gray-700"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSearchItem}
                            disabled={searchLoading}
                            className="bg-yellow-400 px-8 py-3.5 rounded-xl font-black text-gray-900 shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
                        >
                            {searchLoading ? 'Searching...' : 'Search Item'}
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Basic Item Details Section */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-fit">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-2 h-8 bg-yellow-400 rounded-full"></div>
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Basic Item Details</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Item Number</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="itemCode"
                                        value={formData.itemCode}
                                        onChange={handleChange}
                                        onBlur={(e) => handleSearchItem(e.target.value)}
                                        placeholder="SV-00123"
                                        readOnly={isReadOnly}
                                        className={`w-full ${isReadOnly ? 'bg-gray-100' : 'bg-gray-50'} border border-gray-100 px-4 py-3.5 rounded-xl outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all font-bold text-gray-700 pr-12`}
                                        required
                                    />
                                    {searchLoading && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Item Name</label>
                                <input
                                    type="text"
                                    name="itemName"
                                    value={formData.itemName}
                                    onChange={handleChange}
                                    readOnly={isReadOnly}
                                    placeholder={isReadOnly ? "" : "Temple Necklace"}
                                    className={`w-full ${isReadOnly ? 'bg-gray-100' : 'bg-gray-50'} border border-gray-100 px-4 py-3.5 rounded-xl outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all font-bold text-gray-700`}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Jewellery Type</label>
                                <select
                                    name="jewelleryType"
                                    value={formData.jewelleryType}
                                    onChange={handleChange}
                                    disabled={isReadOnly}
                                    className={`w-full ${isReadOnly ? 'bg-gray-100' : 'bg-gray-50'} border border-gray-100 px-4 py-3.5 rounded-xl outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all font-bold text-gray-700 appearance-none pointer-events-auto`}
                                    required
                                >
                                    <option value="">Select Type</option>
                                    <option value="Gold">Gold</option>
                                    <option value="Silver">Silver</option>
                                    <option value="Platinum">Platinum</option>
                                    <option value="Diamond">Diamond</option>
                                </select>
                            </div>
                            <div className={`space-y-2 ${isAddingNewCategory ? 'md:col-span-2' : ''}`}>
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Category</label>
                                {isAddingNewCategory ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="Enter category..."
                                            className="flex-1 bg-yellow-50 border border-yellow-100 px-4 py-3.5 rounded-xl outline-none focus:ring-4 focus:ring-yellow-50 transition-all font-bold text-gray-700"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddNewCategory}
                                            className="bg-yellow-400 px-4 rounded-xl font-black text-gray-900"
                                        >
                                            Add
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingNewCategory(false)}
                                            className="bg-gray-100 px-4 rounded-xl font-bold text-gray-500"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        disabled={isReadOnly}
                                        className={`w-full ${isReadOnly ? 'bg-gray-100' : 'bg-gray-50'} border border-gray-100 px-4 py-3.5 rounded-xl outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all font-bold text-gray-700 appearance-none`}
                                        required
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                        {!isReadOnly && <option value="ADD_NEW" className="text-yellow-600 font-bold">+ Add New Category</option>}
                                    </select>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Design Name</label>
                                <input
                                    type="text"
                                    name="designName"
                                    value={formData.designName}
                                    onChange={handleChange}
                                    readOnly={isReadOnly}
                                    placeholder={isReadOnly ? "" : "Antique Flora"}
                                    className={`w-full ${isReadOnly ? 'bg-gray-100' : 'bg-gray-50'} border border-gray-100 px-4 py-3.5 rounded-xl outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all font-bold text-gray-700`}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Supplier Name</label>
                                <input
                                    type="text"
                                    name="supplierName"
                                    value={formData.supplierName}
                                    onChange={handleChange}
                                    readOnly={isReadOnly}
                                    placeholder={isReadOnly ? "" : "Rajesh Exports"}
                                    className={`w-full ${isReadOnly ? 'bg-gray-100' : 'bg-gray-50'} border border-gray-100 px-4 py-3.5 rounded-xl outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all font-bold text-gray-700`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Weight & Quantity Details Section */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-fit">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-2 h-8 bg-yellow-400 rounded-full"></div>
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Weight & Quantity Details</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Gross Weight (G)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    name="grossWeight"
                                    value={formData.grossWeight}
                                    onChange={handleChange}
                                    readOnly={isReadOnly}
                                    placeholder="0.000"
                                    className={`w-full ${isReadOnly ? 'bg-gray-100' : 'bg-gray-50'} border border-gray-100 px-4 py-3.5 rounded-xl outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all font-bold text-gray-700`}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Net Weight (G)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    name="netWeight"
                                    value={formData.netWeight}
                                    onChange={handleChange}
                                    readOnly={isReadOnly}
                                    placeholder="0.000"
                                    className={`w-full ${isReadOnly ? 'bg-gray-100' : 'bg-gray-50'} border border-gray-100 px-4 py-3.5 rounded-xl outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all font-bold text-gray-700`}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Purity</label>
                                <select
                                    name="purity"
                                    value={formData.purity}
                                    onChange={handleChange}
                                    disabled={isReadOnly}
                                    className={`w-full ${isReadOnly ? 'bg-gray-100' : 'bg-gray-50'} border border-gray-100 px-4 py-3.5 rounded-xl outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all font-bold text-gray-700 appearance-none`}
                                >
                                    <option value="22K (916)">22K (916)</option>
                                    <option value="24K (999)">24K (999)</option>
                                    <option value="18K (750)">18K (750)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-1">Current Quantity</label>
                                <input
                                    type="number"
                                    readOnly
                                    value={formData.currentQuantity}
                                    className="w-full bg-gray-100 border border-gray-100 px-4 py-3.5 rounded-xl outline-none font-bold text-gray-400 cursor-not-allowed"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest pl-1">Quantity to Add</label>
                                <input
                                    type="number"
                                    name="newQuantity"
                                    value={formData.newQuantity}
                                    onChange={handleChange}
                                    readOnly={isReadOnly}
                                    placeholder="1"
                                    className={`w-full ${isReadOnly ? 'bg-gray-100 border-gray-100 text-gray-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'} px-4 py-3.5 rounded-xl outline-none focus:ring-4 focus:ring-emerald-50 transition-all font-bold`}
                                    required
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Actions Footer */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-end gap-4 mt-8">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/stock')}
                        className="px-8 py-3.5 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all active:scale-95"
                    >
                        {isReadOnly ? 'Back to Stock Management' : 'Cancel'}
                    </button>
                    {!isReadOnly && (
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-yellow-400 px-10 py-3.5 rounded-xl font-black text-gray-900 shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : (
                                <>
                                    <Save size={20} />
                                    Save Stock Item
                                </>
                            )}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default AddNewStock;
