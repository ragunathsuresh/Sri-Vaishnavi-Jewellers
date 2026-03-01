import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Box, FileText, Repeat } from 'lucide-react';
import { useDevice } from '../context/DeviceContext';

const BottomNav = ({ user }) => {
    const { isReadOnly } = useDevice();
    const isAdmin = user?.role === 'admin';
    const effectiveReadOnly = isReadOnly || !isAdmin;

    const navItems = [
        { name: 'Home', icon: <Home size={24} />, path: '/admin/dashboard' },
        { name: 'Stock', icon: <Box size={24} />, path: '/admin/stock' },
        { name: 'Summary', icon: <FileText size={24} />, path: '/admin/billing' },
        { name: 'Reports', icon: <FileText size={24} />, path: '/admin/monthly-billing' },
        { name: 'History', icon: <Repeat size={24} />, path: '/admin/transactions' }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-16 px-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50">
            {navItems.map((item) => (
                <NavLink
                    key={item.name}
                    to={item.path}
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 ${isActive
                            ? 'text-yellow-600 font-semibold scale-110'
                            : 'text-gray-400'
                        }`
                    }
                >
                    {item.icon}
                    <span className="text-[10px] font-medium">{item.name}</span>
                </NavLink>
            ))}
        </nav>
    );
};

export default BottomNav;
