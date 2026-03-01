import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../axiosConfig';
import {
    Book,
    Calendar,
    CircleDollarSign,
    Clock3,
    Download,
    Edit2,
    FileText,
    Gem,
    Loader2,
    Plus,
    Scale,
    ShoppingCart,
    Sparkles,
    Wrench
} from 'lucide-react';

import { useDevice } from '../context/DeviceContext';

const Dashboard = () => {
    const { isReadOnly, isMobile } = useDevice();
    const [stats, setStats] = useState(null);
    const [stockTotals, setStockTotals] = useState({ totalItems: 0, totalCount: 0, totalWeight: 0 });
    const [goldRate, setGoldRate] = useState(6250);
    const [isEditingGold, setIsEditingGold] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [loading, setLoading] = useState(true);
    const [isEditingBusinessAmount, setIsEditingBusinessAmount] = useState(false);
    const [businessAmountInput, setBusinessAmountInput] = useState('');
    const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
    const [exportingReport, setExportingReport] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchStats();
    }, [selectedDate]);

    useEffect(() => {
        fetchGoldRate();
    }, []);

    useEffect(() => {
        fetchStockTotals();
    }, []);

    // Unified cash balance sync
    useEffect(() => {
        // No local override needed
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/dashboard/stats?date=${selectedDate}`);
            setStats(data?.data || null);
        } catch (error) {
            console.error('Error fetching stats:', error);
            setStats(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchGoldRate = async () => {
        try {
            const { data } = await api.get('/dashboard/gold-rate');
            setGoldRate(Number(data?.data?.rate || 6250));
        } catch (error) {
            console.error('Error fetching gold rate:', error);
        }
    };

    const fetchStockTotals = async () => {
        try {
            const { data } = await api.get('/stock');
            const rawTotalJewels = data?.stats?.totalJewels;
            const totalItems = typeof rawTotalJewels === 'string'
                ? Number(rawTotalJewels.replace(/\D/g, '')) || 0
                : Number(rawTotalJewels || 0);
            const totalCount = Number(data?.stats?.totalCount || 0);
            const totalWeight = Number(data?.stats?.totalWeight || 0);
            setStockTotals({ totalItems, totalCount, totalWeight });
        } catch (error) {
            console.error('Error fetching stock totals:', error);
        }
    };

    const handleUpdateGoldRate = async () => {
        if (Number.isNaN(Number(goldRate))) return;
        try {
            await api.post('/dashboard/gold-rate', { rate: Number(goldRate) });
            setIsEditingGold(false);
        } catch (error) {
            console.error('Error updating gold rate:', error);
        }
    };

    const dashboardOverview = useMemo(() => {
        const cashAccount = (stats?.assetsAndCash || []).find(a => a.type === 'Cash');
        const currentBusinessAmount = Number(cashAccount?.balance || 0);
        return { currentBusinessAmount };
    }, [stats]);

    const displayedBusinessAmount = dashboardOverview.currentBusinessAmount;

    const handleUpdateBusinessAmount = async () => {
        const parsed = Number(businessAmountInput);
        if (Number.isNaN(parsed)) return;
        try {
            await api.put('/billing/cash-balance', { amount: parsed });
            await fetchStats();
            setIsEditingBusinessAmount(false);
        } catch (error) {
            console.error('Error updating business amount:', error);
        }
    };

    const downloadReport = async (type, params = {}) => {
        try {
            setExportingReport(true);
            let url = '';
            let fileName = '';

            if (type === 'monthly') {
                url = '/reports/monthly/pdf';
                params.month = selectedDate.slice(0, 7);
                fileName = `Monthly_Billing_Summary_${params.month}.pdf`;
            } else if (type === 'daily') {
                url = '/reports/daily/pdf';
                params.date = selectedDate;
                fileName = `Daily_Billing_Summary_${params.date}.pdf`;
            } else if (type === 'stock') {
                url = '/reports/stock/pdf';
                fileName = `Stock_Report_${selectedDate}.pdf`;
            } else if (type === 'transactions') {
                url = '/reports/transactions/pdf';
                fileName = `Transaction_History_${selectedDate}.pdf`;
            }

            const response = await api.get(url, { params, responseType: 'blob' });
            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Report Download Error:', error);
            alert('Failed to download report');
        } finally {
            setExportingReport(false);
        }
    };

    const quickActions = [
        ...(isReadOnly ? [] : [
            { name: 'Add Stock', icon: <Plus size={18} />, path: '/admin/stock', tone: 'from-zinc-900 to-black' },
            { name: 'Line Stock Management', icon: <ShoppingCart size={18} />, path: '/admin/line-stock', tone: 'from-zinc-800 to-black' },
            { name: 'Dealer Management', icon: <CircleDollarSign size={18} />, path: '/admin/dealers', tone: 'from-zinc-700 to-zinc-900' },
            { name: 'Customer Sales', icon: <Book size={18} />, path: '/admin/sales', tone: 'from-zinc-800 to-black' },
        ]),
        { name: 'Transaction History', icon: <Book size={18} />, path: '/admin/transactions', tone: 'from-zinc-700 to-zinc-900' },
        { name: 'Daily Summary', icon: <Wrench size={18} />, path: '/admin/billing', tone: 'from-zinc-800 to-black' },
        { name: 'Monthly Summary', icon: <Book size={18} />, path: '/admin/monthly-billing', tone: 'from-zinc-700 to-zinc-950' },
        ...(isReadOnly ? [] : [
            { name: 'Debt Receivable', icon: <CircleDollarSign size={18} />, path: '/admin/receivable', tone: 'from-zinc-800 to-black' },
            { name: 'Debt Payable', icon: <CircleDollarSign size={18} />, path: '/admin/payable', tone: 'from-zinc-700 to-zinc-900' },
            { name: 'Expenses', icon: <Wrench size={18} />, path: '/admin/expenses', tone: 'from-zinc-800 to-black' },
            { name: 'Purchase Entry', icon: <ShoppingCart size={18} />, path: '/admin/stock/new', tone: 'from-zinc-800 to-black' },
            { name: 'Chit Funds', icon: <Gem size={18} />, path: '/admin/chit', tone: 'from-zinc-700 to-zinc-900' }
        ])
    ];

    return (
        <div
            className="min-h-screen"
            style={{
                backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), url('/home-bg.jpg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
                backgroundColor: '#ffffff'
            }}
        >
            <div className="bg-white/70 backdrop-blur-md border-b border-gray-200 px-8 py-5 sticky top-0 z-50">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-5">
                        <img
                            src="/logo.png"
                            alt="left emblem"
                            className="h-10 w-10 md:h-12 md:w-12 rounded-full border-2 border-yellow-400 object-contain bg-white"
                            onError={(e) => { e.target.src = "https://ui-avatars.com/api/?name=SV&background=111827&color=facc15&bold=true&size=64" }}
                        />
                        <div>
                            <h1 className="text-xl md:text-[44px] leading-[1] font-black uppercase tracking-wide text-yellow-500">Sri Vaishnavi Jewellers</h1>
                            <p className="text-[10px] md:text-sm text-gray-600">Main Bazaar, Trichy</p>
                        </div>
                        {!isMobile && (
                            <img
                                src="/logo.png"
                                alt="right emblem"
                                className="h-12 w-12 rounded-full border-2 border-yellow-400 object-contain bg-white"
                                onError={(e) => { e.target.src = "https://ui-avatars.com/api/?name=SV&background=111827&color=facc15&bold=true&size=64" }}
                            />
                        )}
                    </div>

                    {!isMobile && (
                        <div className="flex items-center gap-3 whitespace-nowrap">
                            <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700">
                                <Calendar size={16} className="text-gray-500" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-transparent outline-none"
                                />
                            </label>

                            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700">
                                <Clock3 size={16} className="text-gray-500" />
                                {format(currentTime, 'hh:mm:ss a')} IST
                            </div>

                            <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-2.5">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Gold Rate (22k)</p>
                                    {isEditingGold ? (
                                        <input
                                            type="number"
                                            value={goldRate}
                                            onChange={(e) => setGoldRate(e.target.value)}
                                            onBlur={handleUpdateGoldRate}
                                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateGoldRate()}
                                            className="w-28 bg-transparent text-2xl font-black text-gray-900 outline-none"
                                            autoFocus
                                        />
                                    ) : (
                                        <p className="text-2xl font-black text-gray-900">Rs.{Number(goldRate || 0).toLocaleString()} <span className="text-base font-medium text-gray-500">/gm</span></p>
                                    )}
                                </div>
                                {!isReadOnly && (
                                    <button onClick={() => setIsEditingGold(true)} className="rounded-lg p-2 text-yellow-700 hover:bg-yellow-100">
                                        <Edit2 size={17} />
                                    </button>
                                )}
                            </div>

                        </div>
                    )}
                </div>
            </div>

            <div className="px-4 py-6 md:px-8 md:py-8">
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl md:text-[40px] leading-none font-extrabold text-gray-900">Dashboard</h2>
                        <p className="mt-1 text-sm md:text-lg text-gray-600">Quick status update for your store.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsReportsModalOpen(true)}
                            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                        >
                            <Download size={16} /> Export Reports
                        </button>
                        {!isReadOnly && (
                            <button onClick={() => navigate('/admin/sales')} className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-gray-900 hover:bg-yellow-500">
                                <Plus size={16} /> Sale
                            </button>
                        )}
                    </div>
                </div>

                <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/50 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition-all hover:shadow-md">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-lg text-gray-600">Total Items</p>
                            <div className="rounded-xl bg-yellow-50 p-2 text-yellow-600"><Gem size={18} /></div>
                        </div>
                        <p className="text-4xl font-extrabold text-gray-900">{loading ? '--' : stockTotals.totalItems.toLocaleString()}</p>
                    </div>

                    <div className="rounded-2xl border border-white/50 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition-all hover:shadow-md">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-lg text-gray-600">Total Grams</p>
                            <div className="rounded-xl bg-yellow-50 p-2 text-yellow-600"><Scale size={18} /></div>
                        </div>
                        <p className="text-4xl font-extrabold text-gray-900">{loading ? '--' : stockTotals.totalWeight.toLocaleString()}<span className="ml-1 text-2xl font-semibold text-gray-500">g</span></p>
                    </div>

                    <div className="rounded-2xl border border-white/50 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition-all hover:shadow-md">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-lg text-gray-600">Monthly Sales</p>
                            <div className="rounded-xl bg-yellow-50 p-2 text-yellow-600"><Sparkles size={18} /></div>
                        </div>
                        <p className="text-4xl font-extrabold text-gray-900 leading-tight">
                            Rs.{loading ? '--' : Number(stats?.totalMonthlySales || 0).toLocaleString()}
                        </p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                            {loading ? '--' : (stats?.monthlySalesCount || 0)} Bills Generated
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/50 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition-all hover:shadow-md">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-lg text-gray-600">Current Amount in the Business</p>
                            <div className="flex items-center gap-2">
                                <div className="rounded-xl bg-yellow-50 p-2 text-yellow-600"><CircleDollarSign size={18} /></div>
                                {!isReadOnly && (
                                    <button
                                        onClick={() => {
                                            setBusinessAmountInput(String(displayedBusinessAmount || 0));
                                            setIsEditingBusinessAmount(true);
                                        }}
                                        className="rounded-lg p-2 text-yellow-700 hover:bg-yellow-50"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                        {isEditingBusinessAmount ? (
                            <input
                                type="number"
                                value={businessAmountInput}
                                onChange={(e) => setBusinessAmountInput(e.target.value)}
                                onBlur={handleUpdateBusinessAmount}
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateBusinessAmount()}
                                className="w-full bg-transparent text-4xl font-extrabold text-gray-900 outline-none"
                                autoFocus
                            />
                        ) : (
                            <p className="text-4xl font-extrabold text-gray-900">Rs.{loading ? '--' : Number(displayedBusinessAmount || 0).toLocaleString()}</p>
                        )}
                    </div>

                </div>

                <div>
                    <h3 className="mb-4 text-4xl leading-none font-extrabold text-gray-900">Quick Actions</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {quickActions.map((action) => (
                            <Link
                                key={action.name}
                                to={action.path}
                                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${action.tone} p-5 text-white`}
                            >
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15),transparent_45%)]" />
                                <div className="relative flex items-end justify-between">
                                    <div className="rounded-full bg-white p-2 text-black">{action.icon}</div>
                                    <p className="text-2xl font-bold">{action.name}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Reports Modal */}
            {isReportsModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsReportsModalOpen(false)}></div>
                    <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">Download PDF Reports</h3>
                            <button onClick={() => setIsReportsModalOpen(false)} className="p-2 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-xl">
                                <Plus size={20} className="rotate-45" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={() => downloadReport('monthly')}
                                disabled={exportingReport}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-yellow-50 hover:border-yellow-200 transition-all group disabled:opacity-50"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-yellow-600 group-hover:scale-110 transition-transform">
                                        <FileText size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-gray-900 text-sm">Monthly Billing Summary</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedDate.slice(0, 7)}</p>
                                    </div>
                                </div>
                                <Download size={18} className="text-gray-300 group-hover:text-yellow-600" />
                            </button>

                            <button
                                onClick={() => downloadReport('daily')}
                                disabled={exportingReport}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-emerald-50 hover:border-emerald-200 transition-all group disabled:opacity-50"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                                        <FileText size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-gray-900 text-sm">Daily Billing Summary</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedDate}</p>
                                    </div>
                                </div>
                                <Download size={18} className="text-gray-300 group-hover:text-emerald-600" />
                            </button>

                            <button
                                onClick={() => downloadReport('stock')}
                                disabled={exportingReport}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-blue-50 hover:border-blue-200 transition-all group disabled:opacity-50"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                        <FileText size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-gray-900 text-sm">Full Stock Report</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global Inventory</p>
                                    </div>
                                </div>
                                <Download size={18} className="text-gray-300 group-hover:text-blue-600" />
                            </button>

                            <button
                                onClick={() => downloadReport('transactions')}
                                disabled={exportingReport}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-purple-50 hover:border-purple-200 transition-all group disabled:opacity-50"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                                        <FileText size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-gray-900 text-sm">Transaction History</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last 30 Days</p>
                                    </div>
                                </div>
                                <Download size={18} className="text-gray-300 group-hover:text-purple-600" />
                            </button>
                        </div>
                        {exportingReport && (
                            <div className="mt-6 flex items-center justify-center gap-3 text-yellow-600 font-bold text-sm">
                                <Loader2 className="animate-spin" size={18} />
                                Generating PDF...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
