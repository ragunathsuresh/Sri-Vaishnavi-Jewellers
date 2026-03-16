
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../axiosConfig';
import {
    ChevronRight,
    Plus,
    Search,
    Filter,
    Box,
    Edit2,
    Trash2,
    Loader2,
    FileText
} from 'lucide-react';

import { useDevice } from '../context/DeviceContext';

const StockManagement = () => {
    const { isReadOnly } = useDevice();
    const navigate = useNavigate();
    const [groupedStocks, setGroupedStocks] = useState([]);
    const [designs, setDesigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesign, setFilterDesign] = useState('All');
    const [filterType, setFilterType] = useState('All');
    const [showDesignFilter, setShowDesignFilter] = useState(false);

    useEffect(() => {
        fetchDesigns();
        fetchGroupedStocks();
    }, [filterDesign, filterType]);

    const fetchDesigns = async () => {
        try {
            const { data } = await api.get('/stock/designs');
            setDesigns(data.data || []);
        } catch (error) {
            console.error('Error fetching designs:', error);
        }
    };

    const fetchGroupedStocks = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/stock/by-design', {
                params: {
                    designName: filterDesign !== 'All' ? filterDesign : undefined,
                    jewelleryType: filterType !== 'All' ? filterType : undefined
                }
            });
            setGroupedStocks(data.data || []);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching grouped stocks:', error);
            setLoading(false);
        }
    };

    const handleDownloadPdf = async () => {
        try {
            setExportingPdf(true);
            const response = await api.get('/reports/stock/pdf', {
                params: {
                    jewelleryType: filterType,
                    designName: filterDesign
                },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `stock_report_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Failed to download PDF report');
        } finally {
            setExportingPdf(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            await api.delete(`/stock/${id}`);
            fetchGroupedStocks();
        } catch (error) {
            console.error('Error deleting stock:', error);
            alert('Failed to delete stock item.');
        }
    };

    // Calculate Global Stats from grouped data
    const globalStats = (groupedStocks || []).reduce((acc, group) => {
        acc.totalCount += (group.totalCount || 0);
        acc.totalWeight += (group.totalWeight || 0);
        acc.totalItems += (group.itemRecordCount || 0);
        return acc;
    }, { totalCount: 0, totalWeight: 0, totalItems: 0 });

    const StockTable = ({ group }) => {
        const filteredItems = group.items.filter(item =>
            (item.serialNo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.itemName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );

        if (filteredItems.length === 0) return null;

        return (
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 rounded-full bg-emerald-500"></div>
                    <div className="flex-1 flex items-center justify-between">
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">Design: {group._id} <span className="text-sm font-bold text-gray-400 ml-2">({filteredItems.length} Records)</span></h2>
                    </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">S.No</th>
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Item Number</th>
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Item Name</th>
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Category</th>
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Count</th>
                                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Weight</th>
                                {!isReadOnly && <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredItems.map((item, index) => (
                                <tr key={item._id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-5 text-center">
                                        <span className="text-sm font-black text-gray-400 group-hover:text-yellow-600 transition-colors tracking-tight">{index + 1}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-sm font-bold text-gray-600 font-mono text-[13px]">{new Date(item.date).toISOString().split('T')[0]}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-sm font-bold text-gray-600 uppercase tracking-wide font-mono">{item.serialNo}</span>
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
                                                <p className="text-[11px] font-bold text-yellow-600 uppercase tracking-wider">
                                                    {typeof item.purity === 'number' ? `${item.purity.toFixed(3)}g Pure` : item.purity}
                                                    {item.plus ? ` (${item.plus}%)` : ''}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-xs font-bold text-gray-500 uppercase">{item.jewelleryType}</span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className="px-2 py-1 bg-gray-50 text-gray-500 text-[10px] font-bold rounded border border-gray-100 uppercase tracking-tight">{item.category}</span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className="px-3 py-1.5 rounded-lg border text-sm font-black bg-gray-50 text-gray-900 border-gray-100 group-hover:bg-white transition-colors">
                                            {item.currentCount || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className="text-base font-black text-gray-900 leading-none">{item.netWeight} <span className="text-[10px] text-gray-400 uppercase ml-0.5">gm</span></span>
                                    </td>
                                    {!isReadOnly && (
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
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50/80 border-t border-gray-100 font-black">
                            <tr>
                                <td colSpan="5" className="px-6 py-4 text-sm text-gray-900 border-r border-gray-100">DESIGN TOTAL ({group._id})</td>
                                <td className="px-6 py-4 text-center text-sm text-gray-600">
                                    <span className="text-[10px] text-gray-400 block uppercase mb-0.5">Records</span>
                                    {group.itemRecordCount}
                                </td>
                                <td className="px-6 py-4 text-center text-sm text-gray-900">
                                    <span className="text-[10px] text-gray-400 block uppercase mb-0.5">Quantity</span>
                                    {group.totalCount}
                                </td>
                                <td className="px-6 py-4 text-center text-sm text-gray-900">
                                    <span className="text-[10px] text-gray-400 block uppercase mb-0.5">Net Weight</span>
                                    <span className="text-base font-black">{group.totalWeight.toFixed(3)}</span>
                                    <span className="text-[10px] text-gray-400 ml-1 uppercase">gm</span>
                                </td>
                                {!isReadOnly && <td></td>}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-1">Stock Management</h1>
                    <p className="text-gray-400 text-sm font-medium">Categorized inventory design-wise with real-time totals.</p>
                </div>
                {!isReadOnly && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/admin/stock/new')}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-yellow-400 px-5 py-2.5 rounded-xl font-black text-gray-900 shadow-md hover:shadow-lg transition-all active:scale-95"
                        >
                            <Plus size={18} />
                            Add Stock
                        </button>
                    </div>
                )}
            </div>

            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-8">
                <div className="w-full md:flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-yellow-500 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search by Name or Serial Number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-gray-100 pl-12 pr-4 py-3.5 rounded-xl outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all text-sm font-medium"
                    />
                </div>

                {/* Design Filter Button */}
                <div className="relative">
                    <button
                        onClick={() => setShowDesignFilter(!showDesignFilter)}
                        className={`flex items-center gap-2 bg-white border ${filterDesign !== 'All' ? 'border-yellow-400 text-yellow-600' : 'border-gray-100 text-gray-600'} px-5 py-3.5 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-50 transition-all active:scale-95`}
                    >
                        <Filter size={18} />
                        {filterDesign === 'All' ? 'Design' : filterDesign}
                    </button>
                    {showDesignFilter && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowDesignFilter(false)}></div>
                            <div className="absolute top-14 left-0 w-64 bg-white border border-gray-100 rounded-2xl shadow-2xl z-20 py-2 max-h-80 overflow-y-auto custom-scrollbar">
                                <button
                                    onClick={() => { setFilterDesign('All'); setShowDesignFilter(false); }}
                                    className={`w-full text-left px-5 py-2.5 text-sm font-bold hover:bg-yellow-50 ${filterDesign === 'All' ? 'text-yellow-600 bg-yellow-50/50' : 'text-gray-600'}`}
                                >
                                    All Designs
                                </button>
                                {designs.map(design => (
                                    <button
                                        key={design}
                                        onClick={() => { setFilterDesign(design); setShowDesignFilter(false); }}
                                        className={`w-full text-left px-5 py-2.5 text-sm font-bold hover:bg-yellow-50 ${filterDesign === design ? 'text-yellow-600 bg-yellow-50/50' : 'text-gray-600'}`}
                                    >
                                        {design}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex-1 md:flex-none relative">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full bg-white border border-gray-100 px-6 py-3.5 rounded-xl font-bold text-xs md:text-sm text-gray-600 outline-none focus:border-yellow-200 focus:ring-4 focus:ring-yellow-50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="All">All Metal Types</option>
                        <option value="Gold">Gold</option>
                        <option value="Silver">Silver</option>
                        <option value="Platinum">Platinum</option>
                        <option value="Diamond">Diamond</option>
                    </select>
                </div>

                <button
                    onClick={() => handleDownloadPdf()}
                    disabled={exportingPdf}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-black transition-all active:scale-95 shadow-sm disabled:opacity-50"
                >
                    {exportingPdf ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                    {exportingPdf ? 'Exporting...' : 'PDF Report'}
                </button>
            </div>

            {/* Sections */}
            {loading ? (
                <div className="py-20 text-center">
                    <Loader2 className="animate-spin mx-auto text-yellow-400 mb-4" size={40} />
                    <p className="text-gray-400 font-bold italic">Loading grouped stock data...</p>
                </div>
            ) : groupedStocks.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center">
                    <Box className="mx-auto text-gray-100 mb-4" size={60} />
                    <p className="text-gray-400 font-bold italic">No stock found matching your criteria.</p>
                </div>
            ) : (
                groupedStocks.map(group => (
                    <StockTable key={group._id} group={group} />
                ))
            )}

            {/* Footer Stats matched to design */}
            <div className="grid grid-cols-1 md:grid-cols-4 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm divide-x divide-gray-100">
                <div className="p-6 bg-gray-50/50">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Unique Items</p>
                    <p className="text-3xl font-black text-gray-900 leading-none">{globalStats.totalItems}</p>
                </div>
                <div className="p-6 text-center">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Quantity</p>
                    <p className="text-3xl font-black text-gray-900 leading-none">{globalStats.totalCount}</p>
                </div>
                <div className="p-6 text-center">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Net Weight</p>
                    <div className="flex items-baseline justify-center gap-1.5 leading-none">
                        <span className="text-3xl font-black text-gray-900">{globalStats.totalWeight.toFixed(3)}</span>
                        <span className="text-lg font-bold text-gray-400">g</span>
                    </div>
                </div>
                <div className="p-6 bg-yellow-400 flex flex-col justify-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white backdrop-blur-md">
                            <Box size={24} />
                        </div>
                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight">Consolidated View</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockManagement;
