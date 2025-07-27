import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Exam from '../models/examModel.js';
import User from '../models/userModel.js';
import connectDB from '../config/db.js';

dotenv.config();

// Connect to database
connectDB();

// Sample exam data
const examData = [
  {
    name: 'Mid-Term Examination 2023',
    examType: 'mid_term',
    class: '10',
    section: 'A',
    subjects: [
      {
        name: 'Mathematics',
        maxMarks: 100,
        passingMarks: 35
      },
      {
        name: 'Science',
        maxMarks: 100,
        passingMarks: 35
      },
      {
        name: 'English',
        maxMarks: 100,
        passingMarks: 35
      }
    ],
    startDate: new Date('2023-09-15'),
    endDate: new Date('2023-09-25'),
    academicYear: '2023',
    isActive: true,
    resultDeclared: false
  },
  {
    name: 'Final Examination 2023',
    examType: 'final_term',
    class: '10',
    section: 'A',
    subjects: [
      {
        name: 'Mathematics',
        maxMarks: 100,
        passingMarks: 35
      },
      {
        name: 'Science',
        maxMarks: 100,
        passingMarks: 35
      },
      {
        name: 'English',
        maxMarks: 100,
        passingMarks: 35
      },
      {
        name: 'Social Studies',
        maxMarks: 100,
        passingMarks: 35
      }
    ],
    startDate: new Date('2023-12-10'),
    endDate: new Date('2023-12-20'),
    academicYear: '2023',
    isActive: true,
    resultDeclared: false
  },
  {
    name: 'Unit Test - April 2024',
    examType: 'unit_test',
    class: '11',
    section: 'B',
    subjects: [
      {
        name: 'Physics',
        maxMarks: 50,
        passingMarks: 18
      },
      {
        name: 'Chemistry',
        maxMarks: 50,
        passingMarks: 18
      },
      {
        name: 'Biology',
        maxMarks: 50,
        passingMarks: 18
      }
    ],
    startDate: new Date('2024-04-05'),
    endDate: new Date('2024-04-10'),
    academicYear: '2024',
    isActive: true,
    resultDeclared: false
  }
];

// Seed function
const seedExams = async () => {
  try {
    // Clear existing exams
    await Exam.deleteMany({});
    console.log('Deleted existing exams');

    // Find an admin user to set as creator
    const admin = await User.findOne({ role: 'admin' });
    
    if (!admin) {
      console.error('No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    // Add createdBy field to each exam
    const examsWithCreator = examData.map(exam => ({
      ...exam,
      createdBy: admin._id
    }));

    // Insert exams
    await Exam.insertMany(examsWithCreator);
    
    console.log('Exams seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error(`Error seeding exams: ${error.message}`);
    process.exit(1);
  }
};

// Run the seed function
seedExams();