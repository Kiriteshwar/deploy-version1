import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Student from '../models/studentModel.js';

const linkStudentData = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/st-marys-portal', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Find the student user
        const studentUser = await User.findOne({ email: 'student@stmarys.edu' });
        if (!studentUser) {
            console.log('Student user not found');
            return;
        }

        // Create or update student data
        const studentData = {
            user: studentUser._id,
            name: studentUser.name,
            email: studentUser.email,
            phone: studentUser.phone,
            class: 'X',
            section: 'A',
            rollNumber: 'STU001',
            guardianName: 'Parent Name',
            guardianPhone: '9876543213',
            address: '123 School Street'
        };

        // Update or create student record
        const student = await Student.findOneAndUpdate(
            { user: studentUser._id },
            studentData,
            { upsert: true, new: true }
        );

        console.log('Student data linked successfully:', student);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

linkStudentData(); 