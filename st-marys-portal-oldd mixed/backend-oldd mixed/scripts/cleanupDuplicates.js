import mongoose from 'mongoose';
import Attendance from '../models/attendanceModel.js';

async function cleanupDuplicates() {
    try {
        await mongoose.connect('mongodb://localhost:27017/st-marys-portal', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Get all records
        const records = await Attendance.find().sort({ date: -1, period: 1 });
        
        // Track unique combinations
        const seen = new Set();
        const duplicateIds = [];

        records.forEach(record => {
            const key = `${record.student}-${record.date.toISOString().split('T')[0]}-${record.period}`;
            if (seen.has(key)) {
                duplicateIds.push(record._id);
            } else {
                seen.add(key);
            }
        });

        if (duplicateIds.length > 0) {
            await Attendance.deleteMany({ _id: { $in: duplicateIds } });
            console.log(`Removed ${duplicateIds.length} duplicate records`);
        } else {
            console.log('No duplicates found');
        }

        // Clear all existing records
        const deleteResult = await Attendance.deleteMany({});
        console.log(`Cleared ${deleteResult.deletedCount} records`);

        await mongoose.disconnect();
        console.log('Cleanup completed');
    } catch (error) {
        console.error('Error:', error);
    }
}

cleanupDuplicates(); 