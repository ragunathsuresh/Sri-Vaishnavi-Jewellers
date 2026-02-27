import React, { useState } from 'react';

const defaultForm = {
    expenseName: '',
    expenseType: 'Daily',
    amount: '',
    notes: '',
    date: new Date().toISOString().slice(0, 10)
};

const ExpenseFormModal = ({ isOpen, mode = 'add', initialData, onClose, onSubmit, saving }) => {
    const [form, setForm] = useState(() => {
        if (mode === 'edit' && initialData) {
            return {
                expenseName: initialData.expenseName || '',
                expenseType: initialData.expenseType || 'Daily',
                amount: initialData.amount ?? '',
                notes: initialData.notes || '',
                date: initialData.expenseDate ? new Date(initialData.expenseDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
            };
        }
        return defaultForm;
    });
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const submitForm = (e) => {
        e.preventDefault();
        if (!form.expenseName.trim()) {
            setError('Expense name is required');
            return;
        }
        if (!form.amount || Number(form.amount) < 0) {
            setError('Amount must be a valid non-negative number');
            return;
        }
        setError('');
        onSubmit({
            expenseName: form.expenseName.trim(),
            expenseType: form.expenseType,
            amount: Number(form.amount),
            notes: form.notes.trim(),
            date: form.date
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-gray-900/45 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-xl font-black text-gray-900">{mode === 'edit' ? 'Edit Expense' : 'Add New Expense'}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                        Close
                    </button>
                </div>

                <form onSubmit={submitForm} className="p-6 space-y-4">
                    {error ? <p className="text-sm text-red-600 font-semibold">{error}</p> : null}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-700">Expense Name</label>
                            <input
                                type="text"
                                value={form.expenseName}
                                onChange={(e) => setForm((prev) => ({ ...prev, expenseName: e.target.value }))}
                                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                                placeholder="Enter expense name"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-700">Date</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-700">Expense Type</label>
                            <select
                                value={form.expenseType}
                                onChange={(e) => setForm((prev) => ({ ...prev, expenseType: e.target.value }))}
                                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                            >
                                <option value="Daily">Daily</option>
                                <option value="Monthly">Monthly</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-700">Amount (Rs.)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.amount}
                                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-gray-700">Notes (Optional)</label>
                        <textarea
                            rows="3"
                            value={form.notes}
                            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-300 outline-none"
                            placeholder="Any additional details..."
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-black shadow disabled:opacity-60"
                        >
                            {saving ? 'Saving...' : mode === 'edit' ? 'Update Expense' : 'Add New Expense'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExpenseFormModal;
