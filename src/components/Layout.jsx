
import React, { useContext } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { AuthContext } from '../context/AuthContext';

const Layout = () => {
    const { user, logout } = useContext(AuthContext);

    return (
        <div className="flex bg-[#F8FAFC] min-h-screen font-sans">
            <Sidebar user={user} logout={logout} />
            <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden">
                <div className="max-w-[1400px] mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
