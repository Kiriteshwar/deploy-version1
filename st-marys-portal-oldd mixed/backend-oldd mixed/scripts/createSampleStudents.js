import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import Student from '../models/studentModel.js';
import bcrypt from 'bcryptjs';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/st-marys-portal')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Classes and sections to create
const classesAndSections = [
    { class: 'X', sections: ['A', 'B'] },
    { class: 'XI', sections: ['A', 'B'] },
    { class: 'XII', sections: ['A', 'B'] }
];

// Hash password
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

// Create sample students
async function createSampleStudents() {
    try {
        // Clear existing student records
        console.log('Clearing existing student records...');
        await Student.deleteMany({});

        // Get all users with student role
        const studentUsers = await User.find({ role: 'student' });

        if (studentUsers.length === 0) {
            console.log('No student users found. Creating student users first...');
            // Create new student users if none exist
            await createStudentUsers();
            // Fetch the newly created users
            const newStudentUsers = await User.find({ role: 'student' });
            createStudentRecords(newStudentUsers);
        } else {
            console.log(`Found ${studentUsers.length} student users. Creating student records...`);
            createStudentRecords(studentUsers);
        }
    } catch (error) {
        console.error('Error creating sample students:', error);
    }
}

// Create student users if needed
async function createStudentUsers() {
    // Hash the default password
    const hashedPassword = await hashPassword('student123');
    
    const totalStudents = 20;
    const studentUsers = [];
    
    for (let i = 1; i <= totalStudents; i++) {
        const user = new User({
            name: `Student ${i}`,
            email: `student${i}@stmarys.edu`,
            password: hashedPassword,
            phone: `123456789${i.toString().padStart(2, '0')}`,
            role: 'student',
            studentInfo: {
                class: 'X', // Default class, will be updated later
                section: 'A', // Default section, will be updated later
                rollNumber: `S${i.toString().padStart(3, '0')}`,
                guardianName: `Parent ${i}`,
                guardianPhone: `987654321${i.toString().padStart(2, '0')}`
            },
            dateOfBirth: new Date(2000, 0, i % 28 + 1), // Random birth date
            gender: i % 2 === 0 ? 'Male' : 'Female',
            joinDate: new Date()
        });
        
        await user.save();
        studentUsers.push(user);
        console.log(`Created student user: ${user.email}`);
    }
    
    return studentUsers;
}

// Create student records with proper references
async function createStudentRecords(studentUsers) {
    // Distribute students across classes and sections
    let studentIndex = 0;
    const students = [];
    
    for (const classObj of classesAndSections) {
        for (const section of classObj.sections) {
            // Add 5-7 students per section
            const studentsInSection = 5 + Math.floor(Math.random() * 3);
            
            for (let i = 0; i < studentsInSection && studentIndex < studentUsers.length; i++) {
                const user = studentUsers[studentIndex];
                
                // Update user's studentInfo
                await User.findByIdAndUpdate(user._id, {
                    'studentInfo.class': classObj.class,
                    'studentInfo.section': section,
                    'studentInfo.rollNumber': `${classObj.class}${section}${(i+1).toString().padStart(2, '0')}`
                });
                
                // Create Student record
                const student = new Student({
                    user: user._id,
                    name: user.name,
                    class: classObj.class,
                    section: section,
                    rollNumber: `${classObj.class}${section}${(i+1).toString().padStart(2, '0')}`,
                    dateOfBirth: user.dateOfBirth || new Date(2000, 0, 1 + Math.floor(Math.random() * 28)),
                    gender: user.gender || (Math.random() > 0.5 ? 'Male' : 'Female'),
                    address: `${Math.floor(Math.random() * 100)} Main St, City`,
                    guardianName: user.studentInfo?.guardianName || `Parent of ${user.name}`,
                    guardianPhone: user.studentInfo?.guardianPhone || '9876543210',
                    bloodGroup: ['A+', 'B+', 'O+', 'AB+'][Math.floor(Math.random() * 4)]
                });
                
                await student.save();
                students.push(student);
                console.log(`Created student record for ${user.name} in Class ${classObj.class}-${section}`);
                
                studentIndex++;
            }
        }
    }
    
    console.log(`Successfully created ${students.length} student records`);
    
    // Additional detailed log
    console.log('\nSample Student Distribution:');
    for (const classObj of classesAndSections) {
        for (const section of classObj.sections) {
            const countInSection = students.filter(s => s.class === classObj.class && s.section === section).length;
            console.log(`Class ${classObj.class}-${section}: ${countInSection} students`);
        }
    }
}

// Run the function
createSampleStudents()
    .then(() => {
        console.log('Sample student data created successfully');
        mongoose.connection.close();
        console.log('MongoDB connection closed');
    })
    .catch(err => {
        console.error('Error:', err);
        mongoose.connection.close();
    }); 