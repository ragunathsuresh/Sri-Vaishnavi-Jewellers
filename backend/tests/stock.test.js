const request = require('supertest');
const app = require('../app');
const Stock = require('../models/Stock');

describe('Stock Controller', () => {
    describe('POST /api/stock', () => {
        it('should add a new stock item', async () => {
            const res = await request(app)
                .post('/api/stock')
                .send({
                    serialNo: 'S001',
                    itemName: 'Gold Ring',
                    jewelleryType: 'Gold',
                    category: 'Ring',
                    grossWeight: 5.5,
                    netWeight: 5.0,
                    purity: '22K',
                    time: '12:00 PM',
                    currentCount: 1,
                    purchaseCount: 1,
                    dealerName: 'Main Dealer'
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.serialNo).toBe('S001');
        });

        it('should update existing stock if serialNo matches', async () => {
            await Stock.create({
                serialNo: 'S002',
                itemName: 'Gold Chain',
                jewelleryType: 'Gold',
                category: 'Chain',
                grossWeight: 10.5,
                netWeight: 10,
                purity: '22K',
                time: '12:00 PM',
                currentCount: 2,
                purchaseCount: 2
            });

            const res = await request(app)
                .post('/api/stock')
                .send({
                    serialNo: 'S002',
                    currentCount: 3 // Restocking 3 more
                });

            expect(res.status).toBe(200);
            expect(res.body.data.currentCount).toBe(5);
            expect(res.body.data.purchaseCount).toBe(5);
        });
    });

    describe('GET /api/stock', () => {
        beforeEach(async () => {
            await Stock.create([
                {
                    serialNo: 'A1', itemName: 'Item A', currentCount: 1, netWeight: 5,
                    jewelleryType: 'Gold', category: 'Ring', grossWeight: 5.5, purity: '22K', time: '10:00 AM'
                },
                {
                    serialNo: 'B1', itemName: 'Item B', currentCount: 0, netWeight: 10,
                    jewelleryType: 'Gold', category: 'Ring', grossWeight: 10.5, purity: '22K', time: '11:00 AM'
                }
            ]);
        });

        it('should fetch all stocks and calculate active stats', async () => {
            const res = await request(app).get('/api/stock');

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(2);
            expect(res.body.stats.totalJewels).toBe('1 Items'); // Only A1 is active
            expect(res.body.stats.totalCount).toBe(1);
            expect(res.body.stats.totalWeight).toBe('5.000');
        });
    });

    describe('GET /api/stock/search', () => {
        it('should search active stocks by serial or name', async () => {
            await Stock.create({
                serialNo: 'X1', itemName: 'Special Ring', currentCount: 1,
                jewelleryType: 'Gold', category: 'Ring', grossWeight: 5.5, netWeight: 5.0, purity: '22K', time: '12:00 PM'
            });

            const res = await request(app).get('/api/stock/search?query=Spec');

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].serialNo).toBe('X1');
        });
    });
});
