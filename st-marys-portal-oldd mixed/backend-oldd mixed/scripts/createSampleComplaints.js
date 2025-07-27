import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Complaint from '../models/complaintModel.js';
import Student from '../models/studentModel.js';
import User from '../models/userModel.js';

dotenv.config();

// Connect to the database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/st-marys-db')
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const categories = ['academic', 'infrastructure', 'staff', 'other'];
const priorities = ['low', 'medium', 'high'];
const statuses = ['pending', 'in_progress', 'resolved', 'rejected'];

const subjects = [
  'Classroom AC not working',
  'Request for additional study materials',
  'School bus arriving late',
  'Request for exam date change',
  'Library book availability issue',
  'Sports equipment damaged',
  'Cafeteria food quality concern',
  'Request for extra classes',
  'School website login issue',
  'Washroom cleanliness issue',
  'Lab equipment malfunctioning',
  'Need clarification on grading policy',
  'Request for parent-teacher meeting',
  'Issue with classroom projector',
  'Query about school timing changes'
];

const descriptions = [
  'The AC in classroom 105 is not cooling properly. It makes a loud noise but doesn\'t reduce the temperature. This makes it difficult for students to concentrate during afternoon classes.',
  'I would like to request additional study materials for the upcoming mathematics exam. The current materials don\'t cover all topics mentioned in the syllabus.',
  'The school bus has been arriving 15-20 minutes late for the past week. This is causing me to miss the first period sometimes.',
  'Due to a family function, I would request if the upcoming English exam could be rescheduled for me.',
  'Several books mentioned in the reference section of our physics syllabus are not available in the school library.',
  'The basketball nets in the court are torn and need replacement. It\'s affecting our practice sessions.',
  'The quality of food in the cafeteria has declined recently. The food is often cold and not fresh.',
  'I am struggling with calculus concepts and would like to request extra classes for better understanding.',
  'I am unable to log in to the school website student portal. It shows an error message every time.',
  'The washrooms near the science lab are not being cleaned regularly and have an unpleasant odor.',
  'The microscopes in the biology lab are not functioning properly. Most of them have focus issues.',
  'I would like clarification on how project grades are calculated in the final score.',
  'I would like to request a meeting with my class teacher to discuss my academic progress.',
  'The projector in our classroom (201) has color issues and displays everything with a green tint.',
  'Is there any change in school timings for the upcoming winter season? Some parents are discussing it.'
];

// Generate random responses
const responseMessages = [
  'Thank you for bringing this to our attention. We will look into this matter immediately.',
  'We have forwarded your concern to the relevant department. They will take necessary action.',
  'Your issue has been registered. We will get back to you with more information soon.',
  'We apologize for the inconvenience. The issue is being addressed and will be resolved soon.',
  'Thank you for your feedback. We are working on improving our services.',
  'We have scheduled a maintenance team to fix this issue by next week.',
  'We appreciate your patience. The concerned staff has been notified about this matter.',
  'Your request has been approved. The changes will be implemented shortly.',
  'We regret to inform you that your request cannot be fulfilled due to policy constraints.',
  'This issue requires further investigation. We have assigned a team to look into it.'
];

async function createSampleComplaints() {
  try {
    // Clear existing complaints
    await Complaint.deleteMany({});
    console.log('Cleared existing complaints');
    
    // Debug: Check all users in the database
    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} total users in the database`);
    console.log('User roles:', allUsers.map(user => user.role).filter((v, i, a) => a.indexOf(v) === i));
    
    // Get all student users
    const studentUsers = await User.find({ role: 'student' });
    console.log(`Found ${studentUsers.length} student users`);
    
    if (studentUsers.length === 0) {
      console.log('No student users found. Please create student users first.');
      process.exit(0);
    }
    
    // Get admin and teacher users for responses
    const staffUsers = await User.find({ role: { $in: ['admin', 'teacher'] } });
    console.log(`Found ${staffUsers.length} staff users (admin/teacher)`);
    
    if (staffUsers.length === 0) {
      console.log('No staff users found. Please create admin/teacher users first.');
      process.exit(0);
    }
    
    // Create 20 random complaints
    const complaints = [];
    
    for (let i = 0; i < 20; i++) {
      const randomStudent = studentUsers[Math.floor(Math.random() * studentUsers.length)];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const randomPriority = priorities[Math.floor(Math.random() * priorities.length)];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];
      const randomDescription = descriptions[Math.floor(Math.random() * descriptions.length)];
      
      // Generate between 0 and 3 responses
      const responses = [];
      const responseCount = Math.floor(Math.random() * 4); // 0 to 3 responses
      
      for (let j = 0; j < responseCount; j++) {
        const randomStaff = staffUsers[Math.floor(Math.random() * staffUsers.length)];
        const randomMessage = responseMessages[Math.floor(Math.random() * responseMessages.length)];
        
        // Create response with random date in the last 30 days
        const responseDate = new Date();
        responseDate.setDate(responseDate.getDate() - Math.floor(Math.random() * 30));
        
        responses.push({
          responder: randomStaff._id,
          message: randomMessage,
          responseDate
        });
      }
      
      // Create a random date within the last 60 days
      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 60));
      
      // Add resolved date if status is resolved
      let resolvedDate = null;
      if (randomStatus === 'resolved') {
        resolvedDate = new Date();
        resolvedDate.setDate(createdDate.getDate() + Math.floor(Math.random() * 10) + 1); // 1-10 days after creation
      }
      
      // Randomly assign to a staff member (30% chance)
      const assignedTo = Math.random() < 0.3 ? staffUsers[Math.floor(Math.random() * staffUsers.length)]._id : null;
      
      const complaint = new Complaint({
        student: randomStudent._id,
        subject: randomSubject,
        description: randomDescription,
        category: randomCategory,
        priority: randomPriority,
        status: randomStatus,
        responses,
        assignedTo,
        resolvedDate,
        createdAt: createdDate,
        updatedAt: createdDate
      });
      
      complaints.push(complaint);
    }
    
    // Save all complaints
    await Complaint.insertMany(complaints);
    
    console.log(`Created ${complaints.length} sample complaints`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating sample complaints:', error);
    process.exit(1);
  }
}

createSampleComplaints(); 