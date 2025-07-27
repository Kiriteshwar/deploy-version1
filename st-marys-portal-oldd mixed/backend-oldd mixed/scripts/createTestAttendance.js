import mongoose from 'mongoose';
import Attendance from '../models/attendanceModel.js';
import User from '../models/userModel.js';

const createTestAttendance = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/st-marys-portal', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Use the student ID from local storage
        const studentId = '681a29e14d0247d114084ed9';  // This matches the user_id in local storage
        
        // Verify the student exists
        const student = await User.findOne({ _id: studentId });
        if (!student) {
            console.log('Student not found. Please check the student ID.');
            return;
        }
        console.log('Found student:', student);

        const teacher = await User.findOne({ role: 'teacher' });
        if (!teacher) {
            console.log('Teacher not found');
            return;
        }

        // Clear existing records first
        await Attendance.deleteMany({ student: studentId });
        console.log('Cleared existing attendance records for student');

        // Define the test data for May 6, 2025
        const may6Data = [
            { period: 1, subject: 'Computer Science', status: 'Absent' },
            { period: 2, subject: 'Mathematics', status: 'Present' },
            { period: 3, subject: 'Computer Science', status: 'Absent' },
            { period: 4, subject: 'Computer Science', status: 'Absent' },
            { period: 5, subject: 'Physics', status: 'No Session' },
            { period: 6, subject: 'Computer Science', status: 'Present' }
        ];

        // Create May 6 records
        const may6 = new Date('2025-05-06T00:00:00.000Z');
        for (const data of may6Data) {
            const record = await Attendance.create({
                student: studentId,
                date: may6,
                period: data.period,
                subject: data.subject,
                status: data.status,
                markedBy: teacher._id,
                class: 'X',
                section: 'A'
            });
            console.log(`Created attendance record for May 6, Period ${data.period}: ${data.subject} - ${data.status}`);
        }

        // Define the test data for May 5, 2025
        const may5Data = [
            { period: 1, subject: 'Physics', status: 'Absent' },
            { period: 2, subject: 'Chemistry', status: 'No Session' },
            { period: 3, subject: 'Mathematics', status: 'Absent' },
            { period: 4, subject: 'Chemistry', status: 'Present' },
            { period: 5, subject: 'Mathematics', status: 'Present' },
            { period: 6, subject: 'English', status: 'No Session' }
        ];

        // Create May 5 records
        const may5 = new Date('2025-05-05T00:00:00.000Z');
        for (const data of may5Data) {
            const record = await Attendance.create({
                student: studentId,
                date: may5,
                period: data.period,
                subject: data.subject,
                status: data.status,
                markedBy: teacher._id,
                class: 'X',
                section: 'A'
            });
            console.log(`Created attendance record for May 5, Period ${data.period}: ${data.subject} - ${data.status}`);
        }

        console.log('Test attendance records created successfully!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

createTestAttendance(); 