
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGO_URI;

console.log('--- Debugging MongoDB Connection ---');

if (!uri) {
    console.error('ERROR: MONGO_URI is not defined in .env');
    process.exit(1);
}

// Mask password for display
const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
console.log(`Loaded URI: ${maskedUri}`);

// Parsing URI to check username
try {
    // Basic regex to find username (between // and :)
    const match = uri.match(/mongodb\+srv:\/\/([^:]+):/);
    if (match) {
        console.log(`Detected Username: ${match[1]}`);
    } else {
        console.log('Could not detect username from URI format');
    }
} catch (e) {
    console.log('Error parsing URI');
}

console.log('Attempting to connect...');

mongoose.connect(uri)
    .then(() => {
        console.log('SUCCESS: Connected to MongoDB!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('CONNECTION FAILED:');
        console.error(err.message);
        if (err.message.includes('bad auth')) {
            console.log('\n--- Troubleshooting ---');
            console.log('1. Verify the Username print above matches your Atlas User.');
            console.log('2. Verify the password is correct for THAT specific user.');
            console.log('3. Ensure no special characters in password are breaking the URI (unless encoded).');
        }
        process.exit(1);
    });
