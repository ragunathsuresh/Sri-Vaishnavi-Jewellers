const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const testAggregation = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const aggregation = [
            { $match: {} },
            {
                $group: {
                    _id: "$designName",
                    items: { $push: "$$ROOT" },
                    totalCount: { $sum: "$currentCount" },
                    totalWeight: { $sum: { $multiply: ["$netWeight", "$currentCount"] } },
                    itemRecordCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ];

        const results = await mongoose.connection.db.collection('stocks').aggregate(aggregation).toArray();
        console.log('Aggregation results count:', results.length);
        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
};

testAggregation();
