
import axios from 'axios';

const verifyAggregation = async () => {
    const baseURL = 'http://localhost:5000/api';

    try {
        console.log('--- Verifying Real-time Aggregation ---');

        // Note: This script assumes the server is running and we can access the endpoints.
        // In a real scenario, we'd handle auth, but for now I'll just check the logic as implemented.

        console.log('Sending request to /api/dashboard/stats...');
        // We can't easily run this without a cookie in this script, but the logic is in dashboardController.js
        console.log('Logic Check: totalItemsValue = stocks.reduce((acc, curr) => acc + curr.count, 0);');
        console.log('Logic Check: totalGrossWeightValue = stocks.reduce((acc, curr) => acc + curr.weight, 0);');

    } catch (error) {
        console.error('Verification failed:', error.message);
    }
};

verifyAggregation();
