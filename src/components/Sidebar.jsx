
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Home,
    Box,
    Truck,
    UserPlus,
    FileText,
    Users,
    ArrowDownLeft,
    ArrowUpRight,
    RefreshCcw,
    Wrench,
    Repeat,
    LogOut
} from 'lucide-react';

import { useDevice } from '../context/DeviceContext';

const Sidebar = ({ user, logout }) => {
    const { isReadOnly } = useDevice();
    const isAdmin = user?.role === 'admin';
    const effectiveReadOnly = isReadOnly || !isAdmin;

    const navItems = [
        { name: 'Home', icon: <Home size={20} />, path: '/admin/dashboard' },
        { name: 'Stock Management', icon: <Box size={20} />, path: '/admin/stock' },
        ...(effectiveReadOnly ? [] : [
            { name: 'Line Stock Management', icon: <Truck size={20} />, path: '/admin/line-stock' },
            { name: 'Dealer Management', icon: <UserPlus size={20} />, path: '/admin/dealers' },
        ]),
        { name: 'Daily Summary', icon: <FileText size={20} />, path: '/admin/billing' },
        { name: 'Monthly Summary', icon: <FileText size={20} />, path: '/admin/monthly-billing' },
        ...(effectiveReadOnly ? [] : [
            { name: 'Customer Sales', icon: <Users size={20} />, path: '/admin/sales' },
            { name: 'Debt Receivable', icon: <ArrowDownLeft size={20} />, path: '/admin/receivable' },
            { name: 'Debt Payable', icon: <ArrowUpRight size={20} />, path: '/admin/payable' },
            { name: 'Chit Funds', icon: <RefreshCcw size={20} />, path: '/admin/chit' },
            { name: 'Expenses', icon: <Wrench size={20} />, path: '/admin/expenses' },
        ]),
        { name: 'Transactions', icon: <Repeat size={20} />, path: '/admin/transactions' }
    ];

    return (
        <aside className="w-64 bg-white border-right border-gray-100 min-h-screen flex flex-col shadow-sm">
            <div className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded-xl">
                    <img
                        src="/logo.png"
                        alt="Sri Vaishnavi Jewellers Logo"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.style.backgroundColor = '#facc15';
                            e.target.parentElement.innerHTML = '<span class="font-bold text-white">SV</span>';
                        }}
                    />
                </div>
                <div>
                    <h1 className="font-bold text-gray-900 leading-tight">Sri Vaishnavi</h1>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold text-nowrap">Jewellers ERP</p>
                </div>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                ? 'bg-yellow-50 text-yellow-600 font-semibold'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`
                        }
                    >
                        {item.icon}
                        <span className="text-sm">{item.name}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-top border-gray-100">


                <button
                    onClick={logout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 text-sm font-medium"
                >
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>

                <div className="mt-4 pt-4 border-top border-gray-100 flex items-center gap-3 px-2">
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border-2 border-white shadow-sm">
                        <img src={`https://ui-avatars.com/api/?name=${user?.name || 'Admin'}&background=FFD700&color=000`} alt="Admin" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900">{user?.name || 'Admin User'}</p>
                        <p className="text-[11px] text-gray-400 font-medium">Manager</p>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
