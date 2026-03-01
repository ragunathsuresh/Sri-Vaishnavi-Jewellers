const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Models
const Sale = require('../models/Sale');
const LineStockSale = require('../models/LineStockSale');
const OtherTransaction = require('../models/OtherTransaction');
const DealerTransaction = require('../models/DealerTransaction');
const ChitFund = require('../models/ChitFund');
const Expense = require('../models/Expense');
const BusinessCalculation = require('../models/BusinessCalculation');

const BACKUP_DIR = path.join(__dirname, '../backups/retention');

/**
 * Ensures the backup directory exists.
 */
const ensureBackupDir = () => {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
};

/**
 * Performs a lightweight backup of records to be deleted.
 * @param {string} modelName - Name of the model
 * @param {Array} records - Records to backup
 * @param {string} dateStr - Date string for filename
 */
const backupRecords = (modelName, records, dateStr) => {
    if (records.length === 0) return;

    const fileName = `${modelName}_${dateStr}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);

    fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
    console.log(`[DataRetention] Backed up ${records.length} records for ${modelName} to ${fileName}`);
};

/**
 * The core cleanup function that removes transactional data older than 365 days.
 */
const runCleanup = async () => {
    console.log(`[DataRetention] Starting daily cleanup task at ${new Date().toLocaleString()}`);

    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');

    ensureBackupDir();

    const transactionalModels = [
        { model: Sale, name: 'Sale' },
        { model: LineStockSale, name: 'LineStockSale' },
        { model: OtherTransaction, name: 'OtherTransaction' },
        { model: DealerTransaction, name: 'DealerTransaction' },
        { model: ChitFund, name: 'ChitFund' },
        { model: Expense, name: 'Expense' },
        { model: BusinessCalculation, name: 'BusinessCalculation' }
    ];

    let totalDeleted = 0;
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            for (const { model, name } of transactionalModels) {
                // Find records older than cutoff date based on createdAt
                const recordsToDelete = await model.find({ createdAt: { $lt: cutoffDate } }).session(session);

                if (recordsToDelete.length > 0) {
                    console.log(`[DataRetention] Identified ${recordsToDelete.length} records for deletion in ${name}`);

                    // Backup before deletion (Backups are external to DB, so they run regardless)
                    backupRecords(name, recordsToDelete, timestampStr);

                    // Perform deletion
                    const result = await model.deleteMany(
                        { _id: { $in: recordsToDelete.map(r => r._id) } },
                        { session }
                    );

                    console.log(`[DataRetention] Successfully marked ${result.deletedCount} records for deletion from ${name}`);
                    totalDeleted += result.deletedCount;
                } else {
                    console.log(`[DataRetention] No records to delete for ${name}`);
                }
            }
        });

        console.log(`[DataRetention] Cleanup transaction committed. Total records removed: ${totalDeleted}`);
    } catch (error) {
        if (error.message && error.message.includes('sessions are not supported')) {
            console.warn('[DataRetention] Warning: Transactions not supported by this MongoDB deployment. Running cleanup without transaction.');
            // Fallback for standalone MongoDB (No Transaction support)
            await runCleanupWithoutTransaction(transactionalModels, cutoffDate, timestampStr);
        } else {
            console.error('[DataRetention] Cleanup transaction aborted due to error:', error);
            throw error;
        }
    } finally {
        session.endSession();
    }
};

/**
 * Fallback cleanup for MongoDB environments that don't support transactions (e.g. local standalone).
 */
const runCleanupWithoutTransaction = async (transactionalModels, cutoffDate, timestampStr) => {
    let totalDeleted = 0;
    for (const { model, name } of transactionalModels) {
        try {
            const recordsToDelete = await model.find({ createdAt: { $lt: cutoffDate } });
            if (recordsToDelete.length > 0) {
                backupRecords(name, recordsToDelete, timestampStr);
                const result = await model.deleteMany({ _id: { $in: recordsToDelete.map(r => r._id) } });
                totalDeleted += result.deletedCount;
                console.log(`[DataRetention] Deleted ${result.deletedCount} records from ${name}`);
            }
        } catch (error) {
            console.error(`[DataRetention] Error in non-transactional cleanup for ${name}:`, error);
        }
    }
    console.log(`[DataRetention] Standalone cleanup completed. Total records removed: ${totalDeleted}`);
};

/**
 * Initializes the scheduled task.
 * Scheduled to run daily at 12:30 AM (00:30).
 */
const init = () => {
    // Cron schedule: minute hour day month dayOfWeek
    // '30 0 * * *' runs at 00:30 (12:30 AM) every day
    cron.schedule('30 0 * * *', () => {
        runCleanup().catch(err => console.error('[DataRetention] Scheduled task failed:', err));
    });

    console.log('[DataRetention] Scheduled background job: 12:30 AM daily');
};

module.exports = {
    runCleanup,
    init
};
