
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Admin = require('./models/Admin');

dotenv.config();

const seedAdmin = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;
        const email = process.env.INITIAL_ADMIN_EMAIL || 'admin@example.com';
        const password = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';

        if (!mongoUri) {
            throw new Error('MONGO_URI is not defined in .env');
        }

        await mongoose.connect(mongoUri);
        console.log('MongoDB Connected');

        let admin = await Admin.findOne({ email });

        if (admin) {
            console.log(`Admin with email ${email} already exists. Updating password...`);
            admin.password = password;
            await admin.save();
            console.log('Admin password updated successfully');
        } else {
            console.log(`Creating new admin with email: ${email}`);
            admin = new Admin({
                name: 'Sri Vaishnavi Admin',
                email: email,
                password: password,
                role: 'admin'
            });
            await admin.save();
            console.log('Admin created successfully');
        }

        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

seedAdmin();
