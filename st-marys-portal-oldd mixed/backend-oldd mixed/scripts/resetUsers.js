import mongoose from 'mongoose';
import User from '../models/userModel.js';

const resetUsers = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/st-marys-portal', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Delete all existing users
        await User.deleteMany({});
        console.log('All existing users deleted');

        // Create new users
        const users = [
            {
                name: "Admin User",
                email: "admin@stmarys.edu",
                password: "admin123",
                phone: "9876543210",
                role: "admin",
                profilePhoto: "default-avatar.jpg",
                isActive: true
            },
            {
                name: "Teacher User",
                email: "teacher@stmarys.edu",
                password: "admin123",
                phone: "9876543211",
                role: "teacher",
                subjects: ["Mathematics", "Physics"],
                profilePhoto: "default-avatar.jpg",
                isActive: true
            },
            {
                name: "Student User",
                email: "student@stmarys.edu",
                password: "admin123",
                phone: "9876543212",
                role: "student",
                profilePhoto: "default-avatar.jpg",
                isActive: true
            }
        ];

        // Create users using the User model
        for (const userData of users) {
            const user = new User(userData);
            await user.save();
            console.log(`Created user: ${userData.email}`);
        }

        console.log('\nNew users created successfully!');
        console.log('\nLogin Credentials:');
        console.log('------------------------');
        console.log('1. Admin User');
        console.log('   Email: admin@stmarys.edu');
        console.log('   Password: admin123');
        console.log('------------------------');
        console.log('2. Teacher User');
        console.log('   Email: teacher@stmarys.edu');
        console.log('   Password: admin123');
        console.log('------------------------');
        console.log('3. Student User');
        console.log('   Email: student@stmarys.edu');
        console.log('   Password: admin123');
        console.log('------------------------');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

resetUsers(); 