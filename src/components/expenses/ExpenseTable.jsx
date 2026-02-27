import React from 'react';

const ExpenseTable = ({ rows, loading, onEdit, onDelete, page = 1, pageSize = 100 }) => {
    const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(Number(value || 0));

    const formatDate = (value) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-10 text-center text-gray-400 font-semibold">
                Loading expenses...
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full min-w-[980px]">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                        {['S.No', 'Expense Name', 'Expense Type', 'Date', 'Time', 'Amount (₹)', 'Notes', 'Action'].map((label) => (
                            <th key={label} className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-black text-gray-500">{label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan="8" className="py-16 text-center text-gray-400 font-semibold">No expenses found.</td>
                        </tr>
                    ) : rows.map((row, idx) => (
                        <tr key={row._id} className="border-b border-gray-50 hover:bg-yellow-50/30">
                            <td className="px-4 py-3 text-sm font-bold text-gray-700">{((page - 1) * pageSize) + idx + 1}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.expenseName}</td>
                            <td className="px-4 py-3 text-sm">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${row.expenseType === 'Monthly' ? 'bg-blue-50 text-blue-600' : 'bg-yellow-50 text-yellow-700'}`}>
                                    {row.expenseType}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{formatDate(row.expenseDate)}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{row.expenseTime || '-'}</td>
                            <td className="px-4 py-3 text-sm font-black text-gray-900">{formatCurrency(row.amount)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-[240px] truncate">{row.notes || '-'}</td>
                            <td className="px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onEdit(row)}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => onDelete(row)}
                                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 font-semibold hover:bg-red-50"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ExpenseTable;
