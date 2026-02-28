import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import StockManagement from './pages/StockManagement';
import AddNewStock from './pages/AddNewStock';
import SalesEntry from './pages/SalesEntry';
import Transactions from './pages/Transactions';
import BillingSummary from './pages/BillingSummary';
import MonthlyBillingSummary from './pages/MonthlyBillingSummary';
import DealerManagement from './pages/DealerManagement';
import DebtReceivable from './pages/DebtReceivable';
import DebtPayable from './pages/DebtPayable';
import ChitFunds from './pages/ChitFunds';
import AddChitFundEntry from './pages/AddChitFundEntry';
import AddPastChitFundEntry from './pages/AddPastChitFundEntry';
import ExpensePage from './pages/ExpensePage';
import ResetPassword from './pages/ResetPassword';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';

// Line Stock Pages
import LineStockDashboard from './pages/LineStock/LineStockDashboard';
import CreateLineStock from './pages/LineStock/CreateLineStock';
import SettleLineStock from './pages/LineStock/SettleLineStock';

function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<AdminLogin />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />
                    <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="/admin" element={<PrivateRoute />}>
                        <Route element={<Layout />}>
                            <Route path="dashboard" element={<Dashboard />} />
                            <Route path="billing" element={<BillingSummary />} />
                            <Route path="monthly-billing" element={<MonthlyBillingSummary />} />
                            <Route path="stock" element={<StockManagement />} />
                            <Route path="stock/new" element={<AddNewStock />} />
                            <Route path="stock/edit/:id" element={<AddNewStock />} />
                            <Route path="dealers" element={<DealerManagement />} />
                            <Route path="receivable" element={<DebtReceivable />} />
                            <Route path="payable" element={<DebtPayable />} />
                            <Route path="sales" element={<SalesEntry />} />
                            <Route path="sales/edit/:id" element={<SalesEntry />} />
                            <Route path="transactions" element={<Transactions />} />
                            <Route path="chit" element={<ChitFunds />} />
                            <Route path="chit/past/new" element={<AddPastChitFundEntry />} />
                            <Route path="chit/past/edit/:id" element={<AddPastChitFundEntry />} />
                            <Route path="chit/new" element={<AddChitFundEntry />} />
                            <Route path="chit/edit/:id" element={<AddChitFundEntry />} />
                            <Route path="expenses" element={<ExpensePage />} />

                            {/* Line Stock Routes */}
                            <Route path="line-stock" element={<LineStockDashboard />} />
                            <Route path="line-stock/create" element={<CreateLineStock />} />
                            <Route path="line-stock/settle/:id" element={<SettleLineStock />} />

                            <Route index element={<Navigate to="/admin/dashboard" replace />} />
                        </Route>
                    </Route>
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
