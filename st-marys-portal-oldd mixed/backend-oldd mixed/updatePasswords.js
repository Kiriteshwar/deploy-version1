// updatePasswords.js
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Student from './models/studentModel.js';

dotenv.config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/st-marys-portal', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function updatePasswords() {
    try {
        const users = [
            { email: 'john.doe@example.com', plainPassword: 'password123' },
            { email: 'j@example.com', plainPassword: '123' },
        ];

        for (const user of users) {
            const hashed = await bcrypt.hash(user.plainPassword, 10);
            const result = await Student.findOneAndUpdate(
                { email: user.email },
                { password: hashed },
                { new: true }
            );
            
            if (result) {
                console.log(`✅ Updated password for: ${user.email}`);
            } else {
                console.log(`❌ User not found: ${user.email}`);
            }
        }

        console.log('✅ All passwords updated with bcrypt hashing.');
    } catch (err) {
        console.error('❌ Error updating passwords:', err);
    } finally {
        await mongoose.connection.close();
    }
}

updatePasswords();
