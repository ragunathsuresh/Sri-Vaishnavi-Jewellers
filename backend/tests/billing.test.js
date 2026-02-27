const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');

// We need to mock or seed data for these tests because they aggregate across multiple models.
// Billing summary usually involves Sales, Expenses, and potentially Chit Funds.

describe('Billing and Expense Controller', () => {
    describe('POST /api/expenses', () => {
        it('should create a new expense via Expense route', async () => {
            const res = await request(app)
                .post('/api/expenses')
                .send({
                    expenseName: 'Tea and Snacks',
                    amount: 150,
                    expenseDate: new Date().toISOString().slice(0, 10),
                    expenseType: 'Daily'
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.expenseName).toBe('Tea and Snacks');
        });
    });

    describe('GET /api/billing/summary', () => {
        it('should fetch the billing summary for a specific date', async () => {
            const today = new Date().toISOString().slice(0, 10);
            const res = await request(app).get(`/api/billing/summary?date=${today}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
        });
    });

    describe('PUT /api/billing/cash-balance', () => {
        it('should update the daily cash balance', async () => {
            const res = await request(app)
                .put('/api/billing/cash-balance')
                .send({ amount: 50000 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.balance).toBe(50000);
        });
    });
});
