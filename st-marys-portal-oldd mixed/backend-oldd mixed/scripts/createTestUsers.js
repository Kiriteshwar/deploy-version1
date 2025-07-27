import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Attendance from '../models/attendanceModel.js';
import bcrypt from 'bcryptjs';

const subjects = [
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Computer Science',
    'English',
    'History',
    'Geography'
];

const createTestUsers = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/st-marys-portal', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Clear existing users and attendance
        await User.deleteMany({});
        await Attendance.deleteMany({});
        console.log('Cleared existing users and attendance records');

        // Create an admin
        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@stmarys.edu',
            password: 'admin123',
            phone: '9876543210',
            role: 'admin',
            adminInfo: {
                designation: 'Principal',
                permissions: ['all']
            }
        });
        console.log('Created admin user:', admin.email);

        // Create a teacher
        const teacher = await User.create({
            name: 'Teacher User',
            email: 'teacher@stmarys.edu',
            password: 'teacher123',
            phone: '9876543211',
            role: 'teacher',
            teacherInfo: {
                subjects: ['Mathematics', 'Physics'],
                qualifications: [{
                    degree: 'M.Sc',
                    institution: 'Example University',
                    year: 2020
                }],
                classTeacher: {
                    class: 'X',
                    section: 'A'
                }
            }
        });
        console.log('Created teacher user:', teacher.email);

        // Create 5 students
        const students = [];
        for (let i = 1; i <= 5; i++) {
            const student = await User.create({
                name: `Student ${i}`,
                email: `student${i}@stmarys.edu`,
                password: 'student123',
                phone: `987654${i}212`,
                role: 'student',
                studentInfo: {
                    class: 'X',
                    section: 'A',
                    rollNumber: `STU00${i}`,
                    guardianName: `Parent ${i}`,
                    guardianPhone: `987654${i}213`,
                    address: `${i} School Street, City`
                }
            });
            students.push(student);
            console.log('Created student user:', student.email);
        }

        // Create attendance records for the past week
        const today = new Date();
        const oneDay = 24 * 60 * 60 * 1000; // milliseconds in one day

        // Create attendance for each day of the past week
        for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
            const date = new Date(today - (dayOffset * oneDay));
            
            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;

            console.log(`Creating attendance for ${date.toDateString()}`);

            // Create attendance for each period
            for (let period = 1; period <= 8; period++) {
                const subject = subjects[period % subjects.length];
                
                // Create attendance for each student
                for (const student of students) {
                    // Randomly mark some students absent (20% chance)
                    const status = Math.random() < 0.2 ? 'Absent' : 'Present';
                    
                    await Attendance.create({
                        student: student._id,
                        date: date,
                        subject: subject,
                        status: status,
                        period: period,
                        markedBy: teacher._id,
                        class: student.studentInfo.class,
                        section: student.studentInfo.section,
                        remarks: status === 'Absent' ? 'Student was absent' : ''
                    });
                }
            }
        }
        console.log('Created attendance records for the past week');

        console.log('\nTest Data Created Successfully!');
        console.log('\nLogin Credentials:');
        console.log('------------------------');
        console.log('1. Admin');
        console.log('   Email: admin@stmarys.edu');
        console.log('   Password: admin123');
        console.log('\n2. Teacher');
        console.log('   Email: teacher@stmarys.edu');
        console.log('   Password: teacher123');
        console.log('\n3. Students');
        console.log('   Email: student1@stmarys.edu (through student5@stmarys.edu)');
        console.log('   Password: student123');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

// Run the function
createTestUsers(); 