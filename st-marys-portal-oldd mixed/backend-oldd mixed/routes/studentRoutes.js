// routes/studentRoutes.js
import express from 'express';
const router = express.Router();
import { registerStudent } from "../controllers/studentController.js";
import { protect } from '../middleware/authMiddleware.js';
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";

router.post('/register', registerStudent);

router.get('/profile', protect, async (req, res) => {
    try {
        // First try to find user in the User model (new structure)
        const user = await User.findById(req.user._id || req.user.id);
        
        if (user) {
            console.log('Found user in User model:', user.name);
            // Return data from User model's studentInfo
            if (user.role === 'student' && user.studentInfo) {
                console.log('User has studentInfo structure:', 
                    `class=${user.studentInfo.class}`, 
                    `section=${user.studentInfo.section}`);
                return res.json({
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        studentInfo: {
                            class: user.studentInfo.class,
                            section: user.studentInfo.section,
                            rollNumber: user.studentInfo.rollNumber
                        }
                    }
                });
            }
        }
        
        // Fallback to old Student model if user not found or doesn't have studentInfo
        const student = await Student.findById(req.user.id);
        if (!student) {
            console.log('Student not found in either model');
            return res.status(404).json({ message: 'Student not found' });
        }

        console.log('Found student in Student model:', 
            `class=${student.class}`, 
            `section=${student.section}`);
        
        res.json({
            user: {
                id: student._id,
                name: student.name,
                email: student.email,
                class: student.class,
                section: student.section,
                rollNumber: student.rollNumber
            }
        });
    } catch (error) {
        console.error('Error in student profile route:', error);
        res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
    }
});

export default router;
