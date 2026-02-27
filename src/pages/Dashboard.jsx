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
    Plus,
    Scale,
    ShoppingCart,
    Sparkles,
    Wrench
} from 'lucide-react';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [stockTotals, setStockTotals] = useState({ totalItems: 0, totalCount: 0, totalWeight: 0 });
    const [goldRate, setGoldRate] = useState(6250);
    const [isEditingGold, setIsEditingGold] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [loading, setLoading] = useState(true);
    const [isEditingBusinessAmount, setIsEditingBusinessAmount] = useState(false);
    const [businessAmountInput, setBusinessAmountInput] = useState('');
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

    const quickActions = [
        { name: 'Add Stock', icon: <Plus size={18} />, path: '/admin/stock', tone: 'from-zinc-900 to-black' },
        { name: 'Line Stock Management', icon: <ShoppingCart size={18} />, path: '/admin/line-stock', tone: 'from-zinc-800 to-black' },
        { name: 'Dealer Management', icon: <CircleDollarSign size={18} />, path: '/admin/dealers', tone: 'from-zinc-700 to-zinc-900' },
        { name: 'Customer Sales', icon: <Book size={18} />, path: '/admin/sales', tone: 'from-zinc-800 to-black' },
        { name: 'Transaction History', icon: <Book size={18} />, path: '/admin/transactions', tone: 'from-zinc-700 to-zinc-900' },
        { name: 'Daily Summary', icon: <Wrench size={18} />, path: '/admin/billing', tone: 'from-zinc-800 to-black' },
        { name: 'Monthly Summary', icon: <Book size={18} />, path: '/admin/monthly-billing', tone: 'from-zinc-700 to-zinc-950' },
        { name: 'Debt Receivable', icon: <CircleDollarSign size={18} />, path: '/admin/receivable', tone: 'from-zinc-800 to-black' },
        { name: 'Debt Payable', icon: <CircleDollarSign size={18} />, path: '/admin/payable', tone: 'from-zinc-700 to-zinc-900' },
        { name: 'Expenses', icon: <Wrench size={18} />, path: '/admin/expenses', tone: 'from-zinc-800 to-black' },
        { name: 'Purchase Entry', icon: <ShoppingCart size={18} />, path: '/admin/stock/new', tone: 'from-zinc-800 to-black' },
        { name: 'Chit Funds', icon: <Gem size={18} />, path: '/admin/chit', tone: 'from-zinc-700 to-zinc-900' }
    ];

    return (
        <div className="min-h-screen bg-[#fafafa]">
            <div className="bg-white border-b border-gray-200 px-8 py-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-5">
                        <img
                            src="/logo.png"
                            alt="left emblem"
                            className="h-12 w-12 rounded-full border-2 border-yellow-400 object-contain bg-white"
                            onError={(e) => { e.target.src = "https://ui-avatars.com/api/?name=SV&background=111827&color=facc15&bold=true&size=64" }}
                        />
                        <div>
                            <h1 className="text-[44px] leading-[1] font-black uppercase tracking-wide text-yellow-500">Sri Vaishnavi Jewellers</h1>
                            <p className="text-sm text-gray-600">Main Bazaar, Trichy</p>
                        </div>
                        <img
                            src="/logo.png"
                            alt="right emblem"
                            className="h-12 w-12 rounded-full border-2 border-yellow-400 object-contain bg-white"
                            onError={(e) => { e.target.src = "https://ui-avatars.com/api/?name=SV&background=111827&color=facc15&bold=true&size=64" }}
                        />
                    </div>

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
                            <button onClick={() => setIsEditingGold(true)} className="rounded-lg p-2 text-yellow-700 hover:bg-yellow-100">
                                <Edit2 size={17} />
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            <div className="px-8 py-8">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-[40px] leading-none font-extrabold text-gray-900">Dashboard Overview</h2>
                        <p className="mt-1 text-lg text-gray-600">Welcome back, get a quick update on your store today.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">
                            <Download size={16} /> Export Report
                        </button>
                        <button onClick={() => navigate('/admin/sales')} className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-gray-900 hover:bg-yellow-500">
                            <Plus size={16} /> New Sale
                        </button>
                    </div>
                </div>

                <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-lg text-gray-600">Total Items</p>
                            <div className="rounded-xl bg-yellow-50 p-2 text-yellow-600"><Gem size={18} /></div>
                        </div>
                        <p className="text-4xl font-extrabold text-gray-900">{loading ? '--' : stockTotals.totalItems.toLocaleString()}</p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-lg text-gray-600">Total Grams</p>
                            <div className="rounded-xl bg-yellow-50 p-2 text-yellow-600"><Scale size={18} /></div>
                        </div>
                        <p className="text-4xl font-extrabold text-gray-900">{loading ? '--' : stockTotals.totalWeight.toLocaleString()}<span className="ml-1 text-2xl font-semibold text-gray-500">g</span></p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-lg text-gray-600">Total Count</p>
                            <div className="rounded-xl bg-yellow-50 p-2 text-yellow-600"><Sparkles size={18} /></div>
                        </div>
                        <p className="text-4xl font-extrabold text-gray-900">{loading ? '--' : stockTotals.totalCount.toLocaleString()}</p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-lg text-gray-600">Current Amount in the Business</p>
                            <div className="flex items-center gap-2">
                                <div className="rounded-xl bg-yellow-50 p-2 text-yellow-600"><CircleDollarSign size={18} /></div>
                                <button
                                    onClick={() => {
                                        setBusinessAmountInput(String(displayedBusinessAmount || 0));
                                        setIsEditingBusinessAmount(true);
                                    }}
                                    className="rounded-lg p-2 text-yellow-700 hover:bg-yellow-50"
                                >
                                    <Edit2 size={16} />
                                </button>
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
        </div>
    );
};

export default Dashboard;
