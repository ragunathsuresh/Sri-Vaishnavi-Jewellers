import React, { useContext } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { AuthContext } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import { LogOut } from 'lucide-react';

const Layout = () => {
    const { user, logout } = useContext(AuthContext);
    const { isDesktop } = useDevice();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="flex bg-[#F8FAFC] min-h-screen font-sans flex-col md:flex-row">
            {isDesktop && <Sidebar user={user} logout={logout} />}

            {!isDesktop && (
                <header className="fixed top-0 left-0 right-0 bg-white h-16 px-4 flex items-center justify-between border-b border-gray-100 z-50 shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center font-bold text-white shadow-inner">SV</div>
                        <h1 className="font-bold text-gray-900 text-lg">Sri Vaishnavi</h1>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="Logout"
                    >
                        <LogOut size={22} />
                    </button>
                </header>
            )}

            <main className={`flex-1 ${!isDesktop ? 'pt-16 pb-16' : 'h-screen overflow-y-auto overflow-x-hidden'}`}>
                <div className="max-w-[1400px] mx-auto px-4 md:px-0">
                    <Outlet />
                </div>
            </main>

            {!isDesktop && <BottomNav user={user} />}
        </div>
    );
};

export default Layout;
