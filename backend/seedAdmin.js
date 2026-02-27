
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Admin = require('./models/Admin');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const adminExists = await Admin.findOne({ email: 'ragusuresh291@gmail.com' });

        if (adminExists) {
            console.log('Admin already exists');
            // Update password just in case it's different
            adminExists.password = 'Ragunath@2006';
            await adminExists.save();
            console.log('Admin password updated');
            process.exit();
        }

        const admin = new Admin({
            name: 'Sri Vaishnavi Admin',
            email: 'ragusuresh291@gmail.com',
            password: 'Ragunath@2006',
            role: 'admin'
        });

        await admin.save();
        console.log('Admin created successfully');
        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

seedAdmin();
