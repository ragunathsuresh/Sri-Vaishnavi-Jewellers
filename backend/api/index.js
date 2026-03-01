const app = require('../app');
const connectDB = require('../config/db');

// Ensure DB connection for serverless
let cachedDb = null;

const handler = async (req, res) => {
    if (!cachedDb) {
        cachedDb = await connectDB();
    }
    return app(req, res);
};

module.exports = handler;
