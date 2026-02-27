
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../axiosConfig';
import {
    ChevronRight,
    Download,
    Plus,
    Search,
    Filter,
    ExternalLink,
    Box,
    Edit2,
    Trash2
} from 'lucide-react';

const StockManagement = () => {
    const navigate = useNavigate();
    const [stocks, setStocks] = useState([]);
    const [stats, setStats] = useState({ totalJewels: '0 Types', totalCount: 0, totalWeight: '0.00' });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchStocks();
    }, []);

    const fetchStocks = async () => {
        try {
            const { data } = await api.get('/stock');
            setStocks(data.data);
            setStats(data.stats);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching stocks:', error);
            setLoading(false);
        }
    };

    const fileInputRef = React.useRef(null);

    const handleExport = () => {
        const headers = ["Serial No", "Origin", "Date", "Item Name", "Jewel Name", "Type", "Purity", "Category", "Design", "Supplier", "Count", "Weight"];
        const rows = filteredStocks.map(item => [
            item.serialNo,
            item.saleType || 'General',
            new Date(item.date).toISOString().split('T')[0],
            `"${item.itemName}"`,
            `"${item.jewelName || item.designName || ''}"`,
            item.jewelleryType,
            item.purity,
            item.category,
            `"${item.designName}"`,
            `"${item.supplierName}"`,
            item.currentCount ?? item.count,
            item.netWeight
        ]);

        const csvContent = headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `stock_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        alert("File selected: " + file.name + ". Parsing and bulk upload logic would go here.");
        // Reset input
        e.target.value = '';
    };

    const [filterType, setFilterType] = useState('All');
    const [originFilter, setOriginFilter] = useState('All');

    const handleAction = (type) => {
        if (type === 'Export') {
            handleExport();
        } else if (type === 'Import CSV') {
            handleImportClick();
        } else {
            alert(`${type} functionality coming soon!`);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/stock/${id}`);
            fetchStocks();
        } catch (error) {
            console.error('Error deleting stock:', error);
            alert('Failed to delete stock item.');
        }
    };

    const filteredStocks = stocks.filter(item => {
        const matchesSearch = (
            (item.serialNo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.itemName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.jewelName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.designName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );

        const matchesType = filterType === 'All' || item.jewelleryType === filterType;
        const matchesOrigin = originFilter === 'All' || (item.saleType || 'General') === originFilter;

        return matchesSearch && matchesType && matchesOrigin;
    });

    const inStock = filteredStocks.filter(item => (Number(item.currentCount ?? item.count) || 0) > 0);
    const zeroStock = filteredStocks.filter(item => (Number(item.currentCount ?? item.count) || 0) === 0);

    // Calculate dynamic stats — active items only (excludes sold/zero stock)
    const dynamicStats = {
        totalJewels: `${inStock.length} Items`,
        totalCount: inStock.reduce((acc, curr) => acc + (Number(curr.currentCount ?? curr.count) || 0), 0),
        totalWeight: inStock.reduce((acc, curr) => acc + ((Number(curr.netWeight) || 0) * (Number(curr.currentCount ?? curr.count) || 1)), 0).toFixed(3)
    };
    const StockTable = ({ data, title, emptyMessage }) => (
        <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
                <div className={`w-1.5 h-6 rounded-full ${title.includes('Active') ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">{title} <span className="text-sm font-bold text-gray-400 ml-2">({data.length})</span></h2>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1400px]">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">S.No</th>
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Origin</th>
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Time</th>
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Item Details</th>
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Item Number</th>
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Category</th>
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Jewel Name</th>
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Count</th>
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Weight</th>
                            <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan="12" className="px-6 py-20 text-center text-gray-400 font-bold italic">Loading stock records...</td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan="12" className="px-6 py-20 text-center text-gray-400 font-bold italic">{emptyMessage}</td>
                            </tr>
                        ) : (
                            data.map((item, index) => (
                                <tr key={item._id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-5 text-center">
                                        <span className="text-sm font-black text-gray-400 group-hover:text-yellow-600 transition-colors tracking-tight">{index + 1}</span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${item.saleType === 'B2B' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                            item.saleType === 'B2C' ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' :
                                                'bg-gray-50 text-gray-400 border border-gray-100'
                                            }`}>
                                            {item.saleType || 'General'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-sm font-bold text-gray-600 font-mono text-[13px]">{new Date(item.date).toISOString().split('T')[0]}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-sm font-bold text-gray-400 uppercase tracking-tighter text-[11px]">{item.time}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 border border-gray-100 overflow-hidden group-hover:bg-white transition-colors">
                                                {item.image ? (
                                                    <img src={item.image} alt={item.itemName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Box size={20} className="group-hover:text-yellow-500 transition-colors" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-gray-900 leading-tight mb-0.5 whitespace-nowrap">{item.itemName}</p>
                                                <p className="text-[11px] font-bold text-yellow-600 uppercase tracking-wider">{item.jewelleryType} | {item.purity}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-sm font-bold text-gray-600 uppercase tracking-wide font-mono">{item.serialNo}</span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className="px-2 py-1 bg-gray-50 text-gray-500 text-[10px] font-bold rounded border border-gray-100 uppercase tracking-tight">{item.category}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-xs font-bold text-gray-400 truncate max-w-[100px] block" title={item.supplierName}>{item.supplierName}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-xs font-bold text-gray-500">{item.jewelName || item.designName || '-'}</span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className={`px-3 py-1.5 rounded-lg border text-sm font-black transition-colors ${Number(item.currentCount ?? item.count) === 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-900 border-gray-100 group-hover:bg-white'}`}>
                                            {item.currentCount ?? item.count}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className="text-base font-black text-gray-900 leading-none">{item.netWeight} <span className="text-[10px] text-gray-400 uppercase ml-0.5">gm</span></span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => navigate(`/admin/stock/edit/${item._id}`)}
                                                className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-yellow-50 hover:text-yellow-600 transition-all border border-gray-100 group-hover:bg-white"
                                                title="Edit Item"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item._id)}
                                                className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all border border-gray-100 group-hover:bg-white"
                                                title="Delete Item"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="p-8">
            <style>
                {`
                    .custom-scrollbar::-webkit-scrollbar {
                        height: 8px;
                        width: 8px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: #f1f1f1;
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: #e2e2e2;
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #cbd5e1;
                    }
                `}
            </style>
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-[13px] font-medium text-gray-400 mb-6">
                <Link to="/admin/dashboard" className="hover:text-yellow-600 transition-colors">Home</Link>
                <ChevronRight size={14} />
                <span className="text-gray-400">Inventory</span>
                <ChevronRight size={14} />
                <span className="text-gray-900">Stock Management</span>
            </nav>

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 mb-1">Stock Management</h1>
                    <p className="text-gray-400 font-medium">Manage your jewelry inventory, track stock levels, and valuations.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleAction('Import CSV')}
                        className="flex items-center gap-2 bg-white border border-gray-100 px-5 py-2.5 rounded-xl font-bold text-gray-600 shadow-sm hover:shadow-md transition-all active:scale-95"
                    >
                        <Download size={18} />
                        Import CSV
                    </button>
                    <button
                        onClick={() => navigate('/admin/stock/new')}
                        className="flex items-center gap-2 bg-yellow-400 px-5 py-2.5 rounded-xl font-black text-gray-900 shadow-md hover:shadow-lg transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        Add New Stock
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-4 mb-8">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-yellow-500 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search by Name, Serial or Design..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-gray-100 pl-12 pr-4 py-3.5 rounded-xl outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all text-sm font-medium"
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-white border border-gray-100 pl-12 pr-8 py-3.5 rounded-xl font-bold text-gray-600 outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="All">All Types</option>
                        <option value="Gold">Gold</option>
                        <option value="Silver">Silver</option>
                        <option value="Platinum">Platinum</option>
                        <option value="Diamond">Diamond</option>
                    </select>
                </div>
                <div className="relative">
                    <Box className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select
                        value={originFilter}
                        onChange={(e) => setOriginFilter(e.target.value)}
                        className="bg-white border border-gray-100 pl-12 pr-8 py-3.5 rounded-xl font-bold text-gray-600 outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="All">All Origins</option>
                        <option value="General">General Stock</option>
                        <option value="B2B">B2B Returns</option>
                        <option value="B2C">B2C Returns</option>
                    </select>
                </div>
                <button
                    onClick={() => handleExport()}
                    className="flex items-center gap-2 bg-white border border-gray-100 px-6 py-3.5 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
                >
                    <ExternalLink size={18} />
                    Export CSV
                </button>
            </div>

            {/* Sections */}
            <StockTable
                data={inStock}
                title="Active Stock"
                emptyMessage="No active stock found matching your search."
            />

            <StockTable
                data={zeroStock}
                title="Sold Out / Zero Stock"
                emptyMessage="No sold out items found matching your search."
            />

            {/* Footer Stats matched to design */}
            <div className="grid grid-cols-1 md:grid-cols-4 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm divide-x divide-gray-100">
                <div className="p-6 bg-gray-50/50">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Jewels</p>
                    <p className="text-3xl font-black text-gray-900 leading-none">{dynamicStats.totalJewels}</p>
                </div>
                <div className="p-6 text-center">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Count</p>
                    <p className="text-3xl font-black text-gray-900 leading-none">{dynamicStats.totalCount}</p>
                </div>
                <div className="p-6 text-center">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Weight</p>
                    <div className="flex items-baseline justify-center gap-1.5 leading-none">
                        <span className="text-3xl font-black text-gray-900">{dynamicStats.totalWeight}</span>
                        <span className="text-lg font-bold text-gray-400">g</span>
                    </div>
                </div>
                <div className="p-6 bg-yellow-400 flex flex-col justify-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white backdrop-blur-md">
                            <Box size={24} />
                        </div>
                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight">System Stock Verified</p>
                    </div>
                </div>
            </div>
            {/* Hidden File Input for Import */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
            />
        </div>
    );
};

export default StockManagement;
