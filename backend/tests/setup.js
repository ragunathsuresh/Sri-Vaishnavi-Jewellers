const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock authMiddleware to bypass authentication during tests
jest.mock('../middlewares/authMiddleware', () => {
    const mongoose = require('mongoose');
    return {
        protect: (req, res, next) => {
            req.user = { _id: new mongoose.Types.ObjectId(), role: 'admin' };
            next();
        },
        admin: (req, res, next) => {
            next();
        }
    };
});

// Mock rateLimiter to avoid blocking tests
jest.mock('../middlewares/rateLimiter', () => ({
    loginLimiter: (req, res, next) => next(),
    apiLimiter: (req, res, next) => next()
}));

let mongoServer;

beforeAll(async () => {
    process.env.JWT_SECRET = 'test_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    // Close existing connections if any
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    await mongoose.connect(uri);
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
});

beforeEach(async () => {
    if (mongoose.connection.readyState !== 0) {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany();
        }
    }
});
