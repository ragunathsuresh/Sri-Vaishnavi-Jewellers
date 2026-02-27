
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Stock = require('./models/Stock');

dotenv.config({ path: path.join(__dirname, '.env') });

const seedData = [
    {
        serialNo: '#001024',
        time: '10:30 AM',
        itemName: 'Gold Wedding Ring',
        jewelleryType: 'Gold',
        category: 'Ring',
        designName: 'Classic Band',
        purchaseInvoiceNo: 'RG-22K-XM9',
        grossWeight: 50.0,
        stoneWeight: 1.5,
        netWeight: 48.5,
        purity: '22K (916)',
        currentCount: 12,
        purchaseCount: 12,
        wastage: 0.1,
        date: new Date('2023-10-24')
    },
    {
        serialNo: '#001025',
        time: '11:15 AM',
        itemName: 'Lakshmi Necklace',
        jewelleryType: 'Gold',
        category: 'Necklace',
        designName: 'Temple Collection',
        purchaseInvoiceNo: 'NC-24K-L01',
        grossWeight: 130.0,
        stoneWeight: 5.0,
        netWeight: 125.0,
        purity: '24K (999)',
        currentCount: 3,
        purchaseCount: 3,
        wastage: 0.2,
        date: new Date('2023-10-24')
    },
    {
        serialNo: '#001026',
        time: '12:00 PM',
        itemName: 'Jhumka Earrings',
        jewelleryType: 'Gold',
        category: 'Earring',
        designName: 'Bridal Set',
        purchaseInvoiceNo: 'ER-22K-J88',
        grossWeight: 66.0,
        stoneWeight: 1.8,
        netWeight: 64.2,
        purity: '22K (916)',
        currentCount: 8,
        purchaseCount: 8,
        wastage: 0.15,
        date: new Date('2023-10-24')
    }
];

const seedStock = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        await Stock.deleteMany();
        console.log('Cleared existing stock');

        await Stock.insertMany(seedData);
        console.log('Stock seeded successfully');

        process.exit();
    } catch (error) {
        console.error('Error seeding stock:', error.message);
        process.exit(1);
    }
};

seedStock();
