const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const ChitFund = require('../models/ChitFund');
const GoldRate = require('../models/GoldRate');

describe('Chit Fund Controller', () => {
    let token;

    beforeAll(async () => {
        // Normally we'd login here and get a token if Auth middleware was strictly enforced.
        // For now, let's assume the routes are accessible or mocked.
    });

    describe('POST /api/chit-funds', () => {
        it('should create a new chit fund entry and calculate grams correctly', async () => {
            await GoldRate.create({ rate: 6000, date: new Date() });

            const res = await request(app)
                .post('/api/chit-funds')
                .send({
                    customerName: 'Test Customer',
                    phoneNumber: '1234567890',
                    amount: 6000,
                    date: new Date()
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.customerName).toBe('Test Customer');
            expect(res.body.data.gramsPurchased).toBe(1); // 6000 / 6000
            expect(res.body.data.serialNumber).toBeDefined();
        });

        it('should return 400 if phone number is invalid', async () => {
            const res = await request(app)
                .post('/api/chit-funds')
                .send({
                    customerName: 'Test Customer',
                    phoneNumber: '123',
                    amount: 6000
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('Phone number must be exactly 10 digits');
        });

        it('should handle past entries with manual grams', async () => {
            const res = await request(app)
                .post('/api/chit-funds')
                .send({
                    customerName: 'Past Customer',
                    phoneNumber: '9876543210',
                    amount: 5000,
                    gramsPurchased: 0.8,
                    isPastEntry: true,
                    goldRateToday: 6250
                });

            expect(res.status).toBe(201);
            expect(res.body.data.gramsPurchased).toBe(0.8);
            expect(res.body.data.isPastEntry).toBe(true);
        });
    });

    describe('GET /api/chit-funds', () => {
        beforeEach(async () => {
            await ChitFund.create([
                {
                    customerName: 'User A',
                    phoneNumber: '1111111111',
                    amount: 1000,
                    gramsPurchased: 0.16,
                    goldRateToday: 6250,
                    date: new Date('2026-01-01')
                },
                {
                    customerName: 'User B',
                    phoneNumber: '2222222222',
                    amount: 2000,
                    gramsPurchased: 0.32,
                    goldRateToday: 6250,
                    date: new Date('2026-01-02')
                }
            ]);
        });

        it('should fetch all entries with summary totals', async () => {
            const res = await request(app).get('/api/chit-funds');

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(2);
            expect(res.body.summary.totalAmount).toBe(3000);
            expect(res.body.summary.totalGrams).toBeCloseTo(0.48);
        });

        it('should filter by search query', async () => {
            const res = await request(app).get('/api/chit-funds?search=User A');

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].customerName).toBe('User A');
        });
    });

    describe('GET /api/chit-funds/customers/search', () => {
        it('should aggregate totals for customers', async () => {
            await ChitFund.create([
                {
                    customerName: 'Repeat User',
                    phoneNumber: '9999999999',
                    amount: 1000,
                    gramsPurchased: 0.1,
                    goldRateToday: 10000,
                    date: new Date()
                },
                {
                    customerName: 'Repeat User',
                    phoneNumber: '9999999999',
                    amount: 2000,
                    gramsPurchased: 0.2,
                    goldRateToday: 10000,
                    date: new Date()
                }
            ]);

            const res = await request(app).get('/api/chit-funds/customers/search?query=999999');

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].totalAmount).toBe(3000);
            expect(res.body.data[0].totalGrams).toBeCloseTo(0.3);
        });
    });
});
