import mongoose from 'mongoose';
import dotenv from 'dotenv';
import colors from 'colors';
import connectDB from '../config/db.js';

// Load environment variables
dotenv.config();

// Function to test database connection
async function testDatabaseConnection() {
  try {
    console.log('Testing MongoDB connection...'.yellow.bold);
    await connectDB();
    console.log('MongoDB connected successfully!'.green.bold);

    // List all collections in the database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nAvailable collections:'.cyan);
    collections.forEach(collection => {
      console.log(`- ${collection.name}`.cyan);
    });

    // Check if timetables collection exists
    const hasTimetablesCollection = collections.some(c => c.name === 'timetables');
    if (hasTimetablesCollection) {
      console.log('\n✅ Timetables collection found!'.green);
      
      // Count documents in timetables collection
      const timetableCount = await mongoose.connection.db.collection('timetables').countDocuments();
      console.log(`There are ${timetableCount} documents in the timetables collection`.green);
      
      // Get a sample document if any exist
      if (timetableCount > 0) {
        const sampleTimetable = await mongoose.connection.db.collection('timetables').findOne();
        console.log('\nSample timetable document:'.yellow);
        console.log(JSON.stringify(sampleTimetable, null, 2));
      }
    } else {
      console.log('\n❌ Timetables collection not found!'.red);
    }

    // Check if users collection exists and get role counts
    const hasUsersCollection = collections.some(c => c.name === 'users');
    if (hasUsersCollection) {
      console.log('\n✅ Users collection found!'.green);
      
      // Count users by role
      const userCollection = mongoose.connection.db.collection('users');
      const totalUsers = await userCollection.countDocuments();
      const adminCount = await userCollection.countDocuments({ role: 'admin' });
      const teacherCount = await userCollection.countDocuments({ role: 'teacher' });
      const studentCount = await userCollection.countDocuments({ role: 'student' });
      
      console.log(`Total users: ${totalUsers}`.green);
      console.log(`- Admins: ${adminCount}`.cyan);
      console.log(`- Teachers: ${teacherCount}`.cyan);
      console.log(`- Students: ${studentCount}`.cyan);
    } else {
      console.log('\n❌ Users collection not found!'.red);
    }

  } catch (error) {
    console.error('Error testing database connection:'.red.bold);
    console.error(error);
  } finally {
    // Close connection
    await mongoose.disconnect();
    console.log('\nDatabase connection closed'.yellow);
  }
}

// Run the test
testDatabaseConnection(); 