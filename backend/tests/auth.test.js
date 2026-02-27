const request = require('supertest');
const app = require('../app');
const Admin = require('../models/Admin');
const bcrypt = require('bcrypt');

describe('Auth Controller', () => {
    beforeEach(async () => {
        await Admin.create({
            name: 'Admin User',
            email: 'admin@example.com',
            password: 'password123',
            role: 'admin'
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login with valid credentials and set cookies', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'admin@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(200);
            expect(res.body.email).toBe('admin@example.com');
            expect(res.headers['set-cookie']).toBeDefined();

            // Check if JWT cookie is present
            const cookies = res.headers['set-cookie'].join(';');
            expect(cookies).toContain('jwt=');
        });

        it('should fail with invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'admin@example.com',
                    password: 'wrongpassword'
                });

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });

        it('should fail if email does not exist', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should clear cookies on logout', async () => {
            const res = await request(app)
                .post('/api/auth/logout');

            expect(res.status).toBe(200);
            const cookies = res.headers['set-cookie'].join(';');
            expect(cookies).toContain('jwt=;'); // Cookie cleared
        });
    });
});
