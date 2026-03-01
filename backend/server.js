const dotenv = require('dotenv');
const path = require('path');

// Load env vars at the very beginning
dotenv.config({ path: path.join(__dirname, '.env') });

const app = require('./app');
const dataRetentionService = require('./services/dataRetentionService');

connectDB().then(() => {
    // Initialize scheduled tasks
    dataRetentionService.init();
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
