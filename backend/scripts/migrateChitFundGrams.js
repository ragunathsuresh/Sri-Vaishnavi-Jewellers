/**
 * Migration: recalculate and save gramsPurchased for all ChitFund records
 * Run once: node backend/scripts/migrateChitFundGrams.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const ChitFund = require('../models/ChitFund');

(async () => {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI);
    console.log('Connected to MongoDB');

    const records = await ChitFund.find({});
    console.log(`Found ${records.length} ChitFund records`);

    let updated = 0;
    let skipped = 0;

    for (const record of records) {
        const amount = Number(record.amount || 0);
        const rateApplied = Number(record.rateApplied || record.goldRateToday || 0);

        if (amount > 0 && rateApplied > 0) {
            const grams = Number((amount / rateApplied).toFixed(6));
            // Use updateOne to bypass validation re-running (avoids serial number re-assignment)
            await ChitFund.updateOne(
                { _id: record._id },
                { $set: { gramsPurchased: grams, rateApplied } }
            );
            updated++;
            console.log(`  Updated ${record._id}: ${amount} / ${rateApplied} = ${grams} gms`);
        } else {
            skipped++;
            console.log(`  Skipped ${record._id}: amount=${amount}, rateApplied=${rateApplied}`);
        }
    }

    console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
    await mongoose.disconnect();
})().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
