import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, ShieldCheck } from 'lucide-react';
import api from '../axiosConfig';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState({ loading: false, success: false, message: '' });

    const onSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setStatus({ loading: false, success: false, message: 'Passwords do not match' });
            return;
        }

        setStatus({ loading: true, success: false, message: '' });
        try {
            const response = await api.put(`/auth/reset-password/${token}`, { password });
            if (response.data.success || response.status === 200) {
                setStatus({ loading: false, success: true, message: 'Password reset successful! Redirecting to login...' });
                setTimeout(() => navigate('/login'), 3000);
            } else {
                setStatus({ loading: false, success: false, message: response.data.message || 'Reset failed. Token may be expired.' });
            }
        } catch (error) {
            setStatus({ loading: false, success: false, message: error.response?.data?.message || 'Server error. Please try again.' });
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 relative overflow-hidden">
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle, #D4AF37 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md z-10 border border-gray-100">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-yellow-100 overflow-hidden">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
                    <p className="text-gray-500 text-sm mt-1">Set your new secure password</p>
                </div>

                {status.message && (
                    <div className={`mb-6 p-4 rounded-xl text-sm flex items-start gap-3 border ${status.success ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {status.success ? <CheckCircle size={18} className="shrink-0 mt-0.5" /> : <span>⚠️</span>}
                        <p>{status.message}</p>
                    </div>
                )}

                {!status.success && (
                    <form onSubmit={onSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min. 8 characters"
                                    required
                                    minLength={8}
                                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-[#D4AF37] focus:border-[#D4AF37] sm:text-sm transition-colors"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repeat new password"
                                    required
                                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-[#D4AF37] focus:border-[#D4AF37] sm:text-sm transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={status.loading}
                            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#D4AF37] hover:bg-[#c29f30] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D4AF37] transition-colors disabled:opacity-70"
                        >
                            {status.loading ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <><ShieldCheck className="h-4 w-4 mr-2" /> Reset Password</>
                            )}
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center">
                    <button onClick={() => navigate('/login')} className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
                        Back to Login
                    </button>
                </div>
            </div>

            <div className="mt-8 text-center text-gray-400 text-xs">
                <p>&copy; 2024 Sri Vaishnavi Jewellers. All Rights Reserved.</p>
            </div>
        </div>
    );
};

export default ResetPassword;
