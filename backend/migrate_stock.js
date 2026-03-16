const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const result = await mongoose.connection.db.collection('stocks').updateMany(
            {
                $or: [
                    { designName: { $exists: false } },
                    { designName: '' },
                    { designName: null }
                ]
            },
            { $set: { designName: 'General Design' } }
        );

        console.log(`Updated ${result.modifiedCount} documents with default designName.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
