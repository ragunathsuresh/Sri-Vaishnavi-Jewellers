const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const dataRetentionService = require('../services/dataRetentionService');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const runStandaloneCleanup = async () => {
    try {
        console.log('--- Manual Data Retention Cleanup Started ---');

        // Connect to Database
        await connectDB();

        // Run Cleanup
        await dataRetentionService.runCleanup();

        console.log('--- Manual Data Retention Cleanup Completed Successfully ---');
        process.exit(0);
    } catch (error) {
        console.error('--- Manual Data Retention Cleanup Failed ---');
        console.error(error);
        process.exit(1);
    }
};

runStandaloneCleanup();
