import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Home, Box, FileText, Repeat, Menu, X,
    Truck, UserPlus, Users, ArrowDownLeft,
    ArrowUpRight, RefreshCcw, Wrench
} from 'lucide-react';
import { useDevice } from '../context/DeviceContext';

const BottomNav = ({ user }) => {
    const { isReadOnly } = useDevice();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const isAdmin = user?.role === 'admin';
    const navigate = useNavigate();

    const mainNavItems = [
        { name: 'Home', icon: <Home size={22} />, path: '/admin/dashboard' },
        { name: 'Stock', icon: <Box size={22} />, path: '/admin/stock' },
        { name: 'Summary', icon: <FileText size={22} />, path: '/admin/billing' },
        { name: 'History', icon: <Repeat size={22} />, path: '/admin/transactions' }
    ];

    const moreItems = [
        { name: 'Monthly Summary', icon: <FileText size={20} />, path: '/admin/monthly-billing' },
        { name: 'Line Stock', icon: <Truck size={20} />, path: '/admin/line-stock' },
        { name: 'Dealers', icon: <UserPlus size={20} />, path: '/admin/dealers' },
        { name: 'Customer Sales', icon: <Users size={20} />, path: '/admin/sales' },
        { name: 'Debt Receivable', icon: <ArrowDownLeft size={20} />, path: '/admin/receivable' },
        { name: 'Debt Payable', icon: <ArrowUpRight size={20} />, path: '/admin/payable' },
        { name: 'Chit Funds', icon: <RefreshCcw size={20} />, path: '/admin/chit' },
        { name: 'Expenses', icon: <Wrench size={20} />, path: '/admin/expenses' },
    ];

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    return (
        <>
            {/* Slide-up Menu Overlay */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={toggleMenu}
            />

            <div
                className={`fixed bottom-0 left-0 right-0 bg-white z-[70] rounded-t-[32px] shadow-2xl transition-transform duration-300 transform ${isMenuOpen ? 'translate-y-0' : 'translate-y-full'}`}
                style={{ maxHeight: '80vh', overflowY: 'auto' }}
            >
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">System Features</h3>
                        <button onClick={toggleMenu} className="p-2 bg-gray-100 rounded-full text-gray-500"><X size={20} /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pb-10">
                        {moreItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                onClick={toggleMenu}
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center p-4 rounded-2xl gap-2 transition-all border ${isActive
                                        ? 'bg-yellow-50 border-yellow-200 text-yellow-700 shadow-sm'
                                        : 'bg-gray-50 border-transparent text-gray-600 active:bg-gray-100'
                                    }`
                                }
                            >
                                <div className={({ isActive }) => `p-2 rounded-xl ${isActive ? 'bg-yellow-100' : 'bg-white shadow-sm'}`}>
                                    {item.icon}
                                </div>
                                <span className="text-[11px] font-bold text-center leading-tight">{item.name}</span>
                            </NavLink>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Bottom Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-16 px-2 shadow-[0_-2px_15px_rgba(0,0,0,0.08)] z-50">
                {mainNavItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 ${isActive
                                ? 'text-yellow-600 font-bold'
                                : 'text-gray-400 active:scale-95'
                            }`
                        }
                    >
                        {item.icon}
                        <span className="text-[10px] font-black uppercase tracking-tighter">{item.name}</span>
                    </NavLink>
                ))}

                <button
                    onClick={toggleMenu}
                    className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 ${isMenuOpen ? 'text-yellow-600 font-bold' : 'text-gray-400 active:scale-95'}`}
                >
                    <Menu size={22} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">More</span>
                </button>
            </nav>
        </>
    );
};

export default BottomNav;
