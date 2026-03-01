import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../axiosConfig';
import { useDevice } from '../context/DeviceContext';

const getTodayDate = () => new Date().toISOString().split('T')[0];
const getCurrentTime = () =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

const AddChitFundEntry = () => {
    const { isReadOnly } = useDevice();
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);
    const [form, setForm] = useState({
        customerName: '',
        phoneNumber: '',
        date: getTodayDate(),
        time: getCurrentTime(),
        amount: '',
        goldRateToday: '',
        gramsPurchased: ''
    });
    const [errors, setErrors] = useState({});
    const [loadingRate, setLoadingRate] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [customerSuggestions, setCustomerSuggestions] = useState([]);

    useEffect(() => {
        if (isEdit) {
            const fetchEntry = async () => {
                setLoadingRate(true);
                try {
                    const { data } = await api.get(`/chit-funds/${id}`);
                    if (data.success && data.data) {
                        const entry = data.data;
                        setForm({
                            customerName: entry.customerName || '',
                            phoneNumber: entry.phoneNumber || '',
                            date: entry.date ? entry.date.split('T')[0] : getTodayDate(),
                            time: entry.time || getCurrentTime(),
                            amount: String(entry.amount || ''),
                            goldRateToday: String(entry.goldRateToday || ''),
                            gramsPurchased: String(entry.gramsPurchased || '')
                        });
                    }
                } catch (error) {
                    console.error('Failed to fetch chit entry:', error);
                    setToast({ type: 'error', message: 'Failed to fetch entry details' });
                } finally {
                    setLoadingRate(false);
                }
            };
            fetchEntry();
        } else {
            const fetchRate = async () => {
                setLoadingRate(true);
                try {
                    const { data } = await api.get('/dashboard/gold-rate');
                    const rate = Number(data?.data?.rate || 0);
                    if (rate) {
                        setForm((prev) => ({
                            ...prev,
                            goldRateToday: String(rate)
                        }));
                    }
                } catch (error) {
                    console.error('Failed to fetch today rate', error);
                } finally {
                    setLoadingRate(false);
                }
            };
            fetchRate();
        }
    }, [id, isEdit]);

    const validate = () => {
        const nextErrors = {};
        if (!form.customerName.trim()) nextErrors.customerName = 'Customer name is required';
        if (!/^\d{10}$/.test(form.phoneNumber.trim())) nextErrors.phoneNumber = 'Phone number must be 10 digits';
        if (!form.date) nextErrors.date = 'Date is required';

        const amount = Number(form.amount);
        if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Amount must be a positive number';

        const goldRateToday = Number(form.goldRateToday);
        if (!Number.isFinite(goldRateToday) || goldRateToday <= 0) nextErrors.goldRateToday = 'Gold rate must be positive';

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const onChange = (field, value) => {
        setForm((prev) => {
            const next = { ...prev, [field]: value };

            if (field === 'amount' || field === 'goldRateToday') {
                const amt = Number(field === 'amount' ? value : next.amount);
                const rate = Number(field === 'goldRateToday' ? value : next.goldRateToday);
                if (amt > 0 && rate > 0) {
                    next.gramsPurchased = (amt / rate).toFixed(3);
                }
            }

            return next;
        });
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    useEffect(() => {
        const query = form.customerName.trim();
        if (query.length < 2) {
            setCustomerSuggestions([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const { data } = await api.get('/chit-funds/customers/search', {
                    params: { query }
                });
                setCustomerSuggestions(Array.isArray(data?.data) ? data.data : []);
            } catch (error) {
                console.error('Failed to search chit customers', error);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [form.customerName]);

    useEffect(() => {
        const query = form.phoneNumber.trim();
        if (query.length < 3) return;

        const timer = setTimeout(async () => {
            try {
                const { data } = await api.get('/chit-funds/customers/search', {
                    params: { query }
                });
                const list = Array.isArray(data?.data) ? data.data : [];
                const exactPhone = list.find((item) => String(item.phoneNumber) === query);
                if (exactPhone?.customerName) {
                    onChange('customerName', String(exactPhone.customerName));
                }
            } catch (error) {
                console.error('Failed to search customer by phone', error);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [form.phoneNumber]);

    const handleCustomerNameChange = (value) => {
        onChange('customerName', value);
        const match = customerSuggestions.find(
            (item) => String(item.customerName || '').toLowerCase() === String(value || '').toLowerCase()
        );
        if (match?.phoneNumber) {
            onChange('phoneNumber', String(match.phoneNumber));
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        try {
            const payload = {
                customerName: form.customerName.trim(),
                phoneNumber: form.phoneNumber.trim(),
                date: form.date,
                time: form.time,
                amount: Number(form.amount),
                gramsPurchased: Number(form.gramsPurchased),
                goldRateToday: Number(form.goldRateToday)
            };

            if (isEdit) {
                await api.put(`/chit-funds/${id}`, payload);
            } else {
                await api.post('/chit-funds', payload);
            }

            navigate('/admin/chit', {
                state: {
                    toast: {
                        type: 'success',
                        message: isEdit ? 'Chit entry updated successfully' : 'Chit entry added successfully'
                    }
                }
            });
        } catch (error) {
            setToast({
                type: 'error',
                message: error.response?.data?.message || 'Failed to save chit entry'
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-6 md:p-8 bg-[#F8FAFC] min-h-screen">
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                        }`}
                >
                    {toast.message}
                </div>
            )}

            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => navigate('/admin/chit')}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-800 mb-4"
                >
                    <ArrowLeft size={16} />
                    Back to Chit Funds
                </button>

                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/80">
                        <h1 className="text-2xl font-black text-gray-900">{isEdit ? 'Edit' : 'Add New'} Chit Entry</h1>
                        <p className="text-gray-500 mt-1">{isEdit ? 'Update existing chit record.' : 'Create a daily chit collection record with automatic grams conversion.'}</p>
                    </div>

                    <form onSubmit={onSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Customer Name *</label>
                            <input
                                value={form.customerName}
                                readOnly={isReadOnly}
                                onChange={(e) => handleCustomerNameChange(e.target.value)}
                                list={isReadOnly ? "" : "chitCustomerList"}
                                className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none ${isReadOnly ? 'bg-gray-100' : ''}`}
                                placeholder={isReadOnly ? "" : "Enter customer name"}
                            />
                            <datalist id="chitCustomerList">
                                {customerSuggestions.map((item) => (
                                    <option
                                        key={item._id || `${item.customerName}-${item.phoneNumber}`}
                                        value={item.customerName}
                                    >
                                        {item.phoneNumber}
                                    </option>
                                ))}
                            </datalist>
                            {errors.customerName && <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number *</label>
                            <input
                                value={form.phoneNumber}
                                readOnly={isReadOnly}
                                onChange={(e) => onChange('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none ${isReadOnly ? 'bg-gray-100' : ''}`}
                                placeholder={isReadOnly ? "" : "10-digit mobile number"}
                            />
                            {errors.phoneNumber && <p className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date *</label>
                            <input
                                type="date"
                                readOnly={isReadOnly}
                                value={form.date}
                                onChange={(e) => onChange('date', e.target.value)}
                                className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none ${isReadOnly ? 'bg-gray-100' : ''}`}
                            />
                            {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time</label>
                            <input
                                value={form.time}
                                readOnly={isReadOnly}
                                onChange={(e) => onChange('time', e.target.value)}
                                className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none ${isReadOnly ? 'bg-gray-100' : ''}`}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount *</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                readOnly={isReadOnly}
                                value={form.amount}
                                onChange={(e) => onChange('amount', e.target.value)}
                                className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none ${isReadOnly ? 'bg-gray-100' : ''}`}
                                placeholder={isReadOnly ? "" : "Enter amount"}
                            />
                            {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Gold Rate Today</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                readOnly={isReadOnly}
                                value={loadingRate ? '' : form.goldRateToday}
                                onChange={(e) => onChange('goldRateToday', e.target.value)}
                                className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none ${isReadOnly ? 'bg-gray-100' : ''}`}
                            />
                            {errors.goldRateToday && <p className="mt-1 text-sm text-red-600">{errors.goldRateToday}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Grams Purchased</label>
                            <input
                                type="number"
                                min="0"
                                step="0.001"
                                readOnly={isReadOnly}
                                value={form.gramsPurchased}
                                onChange={(e) => onChange('gramsPurchased', e.target.value)}
                                className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none ${isReadOnly ? 'bg-gray-100' : ''}`}
                                placeholder="0.000"
                            />
                        </div>

                        <div className="md:col-span-2 flex items-center justify-end gap-3 pt-3 border-t border-gray-100 mt-2">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/chit')}
                                className="px-5 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold"
                            >
                                {isReadOnly ? 'Back to Chit Funds' : 'Cancel'}
                            </button>
                            {!isReadOnly && (
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-extrabold disabled:opacity-60"
                                >
                                    <Save size={16} />
                                    {submitting ? 'Saving...' : 'Save Entry'}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddChitFundEntry;
