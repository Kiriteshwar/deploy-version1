import mongoose from 'mongoose';
import dotenv from 'dotenv';
import colors from 'colors';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * NOTE: This script is no longer the preferred method for creating timetables.
 * Please use the Excel upload functionality in admin-timetable.html instead.
 * This allows you to upload Excel sheets with your custom timetable data.
 * 
 * To access the Excel upload:
 * 1. Log in as an admin
 * 2. Go to Dashboard
 * 3. Click on "Manage Timetables"
 * 4. Use the "Upload Timetable from Excel" section
 */

// Load environment variables
dotenv.config();

// Import models
import Timetable from './models/timetableModel.js';
import User from './models/userModel.js';
import Subject from './models/subjectModel.js';

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/st-marys-portal');
    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`.red.bold);
    process.exit(1);
  }
};

// Seed timetable data
const seedTimetable = async () => {
  try {
    console.log('Fetching existing data from database...'.yellow);
    
    // Get teachers from Users collection with more detailed info
    const teachers = await User.find({ role: 'teacher' }).select('name teacherInfo');
    if (teachers.length === 0) {
      console.log('No teachers found in database! Using default teacher names.'.red);
    } else {
      console.log(`Found ${teachers.length} teachers in database`.green);
    }
    
    // Get subjects from Subjects collection
    const subjects = await Subject.find().select('name');
    if (subjects.length === 0) {
      console.log('No subjects found in database! Using default subject names.'.red);
    } else {
      console.log(`Found ${subjects.length} subjects in database`.green);
    }
    
    // Get all classes and sections from students
    const classData = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: { class: "$studentInfo.class", section: "$studentInfo.section" } } }
    ]);
    
    // Extract actual class-section pairs (not just all possible combinations)
    const classSectionPairs = [];
    
    classData.forEach(item => {
      if (item._id && item._id.class && item._id.section) {
        classSectionPairs.push({
          class: item._id.class,
          section: item._id.section
        });
      }
    });
    
    if (classSectionPairs.length === 0) {
      console.log('No class-section pairs found from student data! Using default values.'.red);
      // Default pairs if none found
      const defaultClasses = ['VIII', 'IX', 'X'];
      const defaultSections = ['A', 'B', 'C'];
      
      defaultClasses.forEach(cls => {
        defaultSections.forEach(sec => {
          classSectionPairs.push({
            class: cls,
            section: sec
          });
        });
      });
    } else {
      console.log(`Found ${classSectionPairs.length} class-section pairs in database`.green);
    }
    
    // Print the class-section pairs for verification
    console.log('Class-Section pairs:');
    classSectionPairs.forEach(pair => {
      console.log(`  ${pair.class}-${pair.section}`);
    });
    
    // Create a map of teachers with their subjects
    const teacherSubjectMap = new Map();
    
    // If real teachers found, try to use their teacherInfo
    if (teachers.length > 0) {
      teachers.forEach(teacher => {
        if (teacher.teacherInfo && teacher.teacherInfo.subjects && teacher.teacherInfo.subjects.length > 0) {
          teacherSubjectMap.set(teacher.name, teacher.teacherInfo.subjects);
        } else {
          // If teacher has no subjects assigned, choose 1-3 random subjects
          const numSubjects = Math.floor(Math.random() * 3) + 1;
          const teacherSubjects = [];
          
          for (let i = 0; i < numSubjects && i < subjects.length; i++) {
            const randomSubject = subjects[Math.floor(Math.random() * subjects.length)].name;
            if (!teacherSubjects.includes(randomSubject)) {
              teacherSubjects.push(randomSubject);
            }
          }
          
          teacherSubjectMap.set(teacher.name, teacherSubjects);
        }
      });
    } else {
      // Default teacher-subject mappings if no real teachers found
      const defaultTeachers = [
        'Mr. John Smith', 
        'Ms. Sarah Johnson', 
        'Mr. Robert Williams', 
        'Mrs. Emily Davis', 
        'Dr. Michael Brown'
      ];
      
      const defaultSubjects = [
        'Mathematics', 
        'English', 
        'Science', 
        'History', 
        'Geography', 
        'Physics', 
        'Chemistry', 
        'Biology', 
        'Computer Science'
      ];
      
      defaultTeachers.forEach(teacher => {
        const numSubjects = Math.floor(Math.random() * 3) + 1;
        const teacherSubjects = [];
        
        for (let i = 0; i < numSubjects; i++) {
          const randomSubject = defaultSubjects[Math.floor(Math.random() * defaultSubjects.length)];
          if (!teacherSubjects.includes(randomSubject)) {
            teacherSubjects.push(randomSubject);
          }
        }
        
        teacherSubjectMap.set(teacher, teacherSubjects);
      });
    }
    
    // Print teacher-subject mappings for verification
    console.log('Teacher-Subject mappings:');
    teacherSubjectMap.forEach((subjects, teacher) => {
      console.log(`  ${teacher}: ${subjects.join(', ')}`);
    });
    
    // Extract teacher names and subject names
    const teacherNames = Array.from(teacherSubjectMap.keys());
    
    const subjectNames = subjects.length > 0
      ? subjects.map(s => s.name)
      : ['Mathematics', 'English', 'Science', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 'Computer Science'];
    
    console.log('Seeding timetable data...'.yellow);
    console.log(`Using ${teacherNames.length} teachers, ${subjectNames.length} subjects, ${classSectionPairs.length} class-section pairs`.blue);
    
    const bulkOperations = [];
    const academicYear = new Date().getFullYear().toString();
    
    // Generate sample timetable for each class-section pair
    for (const pair of classSectionPairs) {
      console.log(`Creating entries for class ${pair.class}-${pair.section}...`.blue);
      
      // Create entries for Monday to Friday (1-5)
      for (let day = 1; day <= 5; day++) {
        // Create 8 periods per day
        for (let period = 1; period <= 8; period++) {
          // Pick a random subject
          const randomSubject = subjectNames[Math.floor(Math.random() * subjectNames.length)];
          
          // Find a teacher who can teach this subject
          let eligibleTeachers = [];
          teacherSubjectMap.forEach((subjects, teacher) => {
            if (subjects.includes(randomSubject)) {
              eligibleTeachers.push(teacher);
            }
          });
          
          // If no eligible teachers found, pick any teacher
          if (eligibleTeachers.length === 0) {
            eligibleTeachers = teacherNames;
          }
          
          // Pick a random eligible teacher
          const randomTeacher = eligibleTeachers[Math.floor(Math.random() * eligibleTeachers.length)];
          
          bulkOperations.push({
            updateOne: {
              filter: {
                class: pair.class,
                section: pair.section,
                dayOfWeek: day,
                period,
                academicYear
              },
              update: {
                $set: {
                  subject: randomSubject,
                  teacher: randomTeacher,
                  isActive: true
                }
              },
              upsert: true
            }
          });
        }
      }
    }
    
    // Clear existing data if requested
    if (process.argv.includes('--clear')) {
      console.log('Clearing existing timetable data...'.red);
      await Timetable.deleteMany({});
    }
    
    // Use bulkWrite for better performance
    console.log(`Performing ${bulkOperations.length} database operations...`.yellow);
    const result = await Timetable.bulkWrite(bulkOperations);
    
    console.log('Timetable data seeded successfully!'.green.bold);
    console.log(`Operations: ${result.upsertedCount} created, ${result.modifiedCount} updated`.green);
    
    mongoose.connection.close();
    console.log('Database connection closed'.gray);
  } catch (error) {
    console.error(`Error: ${error.message}`.red.bold);
    process.exit(1);
  }
};

// Run the seed function
connectDB().then(() => seedTimetable()); 