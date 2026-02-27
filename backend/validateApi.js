
const axios = require('axios');

const API_URL = 'http://localhost:5000/api/auth';

const testLogin = async () => {
    console.log('--- Testing Login API ---');
    try {
        // 1. Valid Login
        console.log('1. Attempting Valid Login...');
        const res = await axios.post(`${API_URL}/login`, {
            email: 'admin@sri.com',
            password: 'password123'
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`[PASS] Valid Login: Status ${res.status}`);
        if (res.headers['set-cookie']) {
            console.log(`[PASS] Cookies Set: ${res.headers['set-cookie'].length > 0}`);
        } else {
            console.log(`[FAIL] No cookies set!`);
        }

    } catch (error) {
        console.log(`[FAIL] Valid Login: ${error.message}`);
        if (error.response) {
            console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
        }
    }

    try {
        // 2. Invalid Login
        console.log('\n2. Attempting Invalid Login...');
        await axios.post(`${API_URL}/login`, {
            email: 'admin@sri.com',
            password: 'wrongpassword'
        });
        console.log(`[FAIL] Invalid Login should have failed but returned success.`);
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log(`[PASS] Invalid Login: Status 401`);
        } else {
            console.log(`[FAIL] Invalid Login: Unexpected status ${error.response ? error.response.status : error.message}`);
        }
    }

    // 3. Rate Limiting Test
    console.log('\n3. Testing Rate Limiting (Sending 6 requests)...');
    let attempts = 0;
    for (let i = 0; i < 6; i++) {
        try {
            await axios.post(`${API_URL}/login`, {
                email: 'admin@sri.com',
                password: 'wrongpassword'
            });
            attempts++;
            console.log(`Attempt ${i + 1}: 200 OK (Unexpected)`);
        } catch (error) {
            attempts++;
            if (error.response) {
                if (error.response.status === 429) {
                    console.log(`[PASS] Attempt ${i + 1}: Rate Limit Hit (429)`);
                    break;
                } else {
                    console.log(`Attempt ${i + 1}: Status ${error.response.status}`);
                }
            } else {
                console.log(`Attempt ${i + 1}: Error ${error.message}`);
            }
        }
    }
};

const main = async () => {
    // Wait for server to be ready?
    // We assume server is running on 5000
    try {
        await testLogin();
    } catch (e) {
        console.error(e);
    }
};

main();
