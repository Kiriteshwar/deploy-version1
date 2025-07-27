import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Student from '../models/studentModel.js';
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

const createTestStudentsAndAttendance = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/st-marys-portal', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Get or create a teacher
        let teacher = await User.findOne({ role: 'teacher' });
        if (!teacher) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            teacher = await User.create({
                name: 'Test Teacher',
                email: 'teacher@stmarys.edu',
                password: hashedPassword,
                phone: '9876543210',
                role: 'teacher'
            });
        }

        // Create test students
        const students = [
            {
                name: 'John Doe',
                email: 'john.doe@stmarys.edu',
                phone: '9876543201',
                class: 'X',
                section: 'A',
                rollNumber: 'STU001'
            },
            {
                name: 'Jane Smith',
                email: 'jane.smith@stmarys.edu',
                phone: '9876543202',
                class: 'X',
                section: 'A',
                rollNumber: 'STU002'
            },
            {
                name: 'Mike Johnson',
                email: 'mike.johnson@stmarys.edu',
                phone: '9876543203',
                class: 'X',
                section: 'A',
                rollNumber: 'STU003'
            },
            {
                name: 'Sarah Williams',
                email: 'sarah.williams@stmarys.edu',
                phone: '9876543204',
                class: 'X',
                section: 'A',
                rollNumber: 'STU004'
            },
            {
                name: 'Alex Brown',
                email: 'alex.brown@stmarys.edu',
                phone: '9876543205',
                class: 'X',
                section: 'A',
                rollNumber: 'STU005'
            }
        ];

        // Clear existing student users and attendance records
        await User.deleteMany({ role: 'student' });
        await Student.deleteMany({});
        await Attendance.deleteMany({});

        console.log('Cleared existing student and attendance records');

        // Create student users and their profiles
        const createdStudents = [];
        for (const studentData of students) {
            const hashedPassword = await bcrypt.hash('student123', 10);
            
            // Create user account
            const user = await User.create({
                name: studentData.name,
                email: studentData.email,
                password: hashedPassword,
                phone: studentData.phone,
                role: 'student'
            });

            // Create student profile (without password)
            const student = await Student.create({
                user: user._id,
                name: studentData.name,
                email: studentData.email,
                phone: studentData.phone,
                address: '123 School Street',
                class: studentData.class,
                section: studentData.section,
                rollNumber: studentData.rollNumber,
                guardianName: 'Parent Name',
                guardianPhone: '9876543200'
            });

            createdStudents.push({ user, student });
            console.log(`Created student: ${studentData.name}`);
        }

        // Generate attendance for the past week
        const today = new Date();
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);

        // Create attendance records for each student
        for (const { student } of createdStudents) {
            let currentDate = new Date(oneWeekAgo);

            while (currentDate <= today) {
                // Skip weekends
                if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                    // Create 6 periods per day
                    for (let period = 1; period <= 6; period++) {
                        const subject = subjects[Math.floor(Math.random() * subjects.length)];
                        
                        // Generate realistic attendance patterns
                        // 85% chance of being present
                        // 10% chance of being absent
                        // 5% chance of no session
                        const random = Math.random();
                        let status;
                        if (random < 0.85) {
                            status = 'Present';
                        } else if (random < 0.95) {
                            status = 'Absent';
                        } else {
                            status = 'No Session';
                        }

                        await Attendance.create({
                            student: student._id,
                            date: new Date(currentDate),
                            period,
                            subject,
                            status,
                            markedBy: teacher._id,
                            class: student.class,
                            section: student.section
                        });

                        console.log(`Created attendance for ${student.name} on ${currentDate.toDateString()} Period ${period}: ${status}`);
                    }
                }
                
                // Move to next day
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        console.log('\nTest data creation completed successfully!');
        console.log('\nStudent Login Credentials:');
        console.log('------------------------');
        for (const student of students) {
            console.log(`${student.name}`);
            console.log(`Email: ${student.email}`);
            console.log(`Password: student123`);
            console.log('------------------------');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

createTestStudentsAndAttendance(); 