// // controllers/teacherController.js
// import bcrypt from 'bcrypt';
// import jwt from 'jsonwebtoken';
// import teacherModel from '../models/teacherModel.js';
// import { JWT_SECRET } from '../config/auth.js';

// const registerTeacher = async (req, res) => {
//   try {
//     const { name, email, password, phone } = req.body;
//     const existing = await teacherModel.getTeacherByEmail(email);
//     if (existing) return res.status(400).json({ message: 'Email already registered' });

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const teacher = await teacherModel.createTeacher({ name, email, password: hashedPassword, phone });
//     res.status(201).json({ message: 'Teacher registered', teacher });
//   } catch (err) {
//     res.status(500).json({ message: 'Registration failed', error: err.message });
//   }
// };

// const loginTeacher = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const teacher = await teacherModel.getTeacherByEmail(email);
//     if (!teacher) return res.status(401).json({ message: 'Invalid email or password' });

//     const valid = await bcrypt.compare(password, teacher.password);
//     if (!valid) return res.status(401).json({ message: 'Invalid email or password' });

//     const token = jwt.sign({ id: teacher.id, role: 'teacher' }, JWT_SECRET, { expiresIn: '1d' });
//     res.json({ message: 'Login successful', token });
//   } catch (err) {
//     res.status(500).json({ message: 'Login failed', error: err.message });
//   }
// };

// module.exports = {
//   registerTeacher,
//   loginTeacher,
// };

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Teacher from '../models/teacherModel.js';
import Exam from '../models/examModel.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import TeacherAttendance from '../models/teacherAttendanceModel.js';

export async function registerTeacher(req, res) {
    try {
        const { name, email, password, phone, subject, qualifications } = req.body;
        
        const existingTeacher = await Teacher.findOne({ email });
        if (existingTeacher) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const teacher = await Teacher.create({
            name,
            email,
            password,
            phone,
            subject,
            qualifications
        });

        const token = jwt.sign(
            { id: teacher._id, role: 'teacher' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(201).json({
            message: 'Teacher registered successfully',
            teacher: {
                id: teacher._id,
                name: teacher.name,
                email: teacher.email,
                subject: teacher.subject
            },
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
}

export async function loginTeacher(req, res) {
    try {
        const { email, password } = req.body;
        
        const teacher = await Teacher.findOne({ email }).select('+password');
        if (!teacher) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await teacher.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: teacher._id, role: 'teacher' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login successful',
            teacher: {
                id: teacher._id,
                name: teacher.name,
                email: teacher.email,
                subject: teacher.subject
            },
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
}

// Get classes that a teacher teaches
export const getTeacherClasses = async (req, res) => {
    try {
        const teacherId = req.user._id;
        console.log('Fetching classes for teacher ID:', teacherId);
        
        // Query the database for distinct classes using User model
        const User = mongoose.model('User');
        const studentClasses = await User.find({ role: 'student' }).distinct('studentInfo.class');
        const teacherClasses = await User.find({ role: 'teacher' }).distinct('teacherInfo.classTeacher.class');
        const usedClasses = Array.from(new Set([...studentClasses, ...teacherClasses])).filter(Boolean);

        // Optionally, include homework classes only if they are also in use
        let additionalClasses = [];
        try {
            const Homework = mongoose.model('Homework');
            additionalClasses = await Homework.distinct('class');
        } catch (err) {
            additionalClasses = [];
        }
        // Only include homework classes that are also in use
        const allClasses = Array.from(new Set([...usedClasses, ...additionalClasses.filter(cls => usedClasses.includes(cls))])).filter(Boolean);

        // Get all distinct subjects from the database instead of hardcoding
        let subjects = [];
        try {
            const Attendance = mongoose.model('Attendance');
            subjects = await Attendance.distinct('subject');
            console.log('Found subjects from Attendance:', subjects);
        } catch (err) {
            console.log('Could not fetch subjects from Attendance, trying alternate sources:', err.message);
        }
        
        // If no subjects found, try from Teacher model
        if (!subjects || subjects.length === 0) {
            try {
                const allTeachers = await User.find({ role: 'teacher' }).select('teacherInfo.subjects');
                const subjectSet = new Set();
                allTeachers.forEach(teacher => {
                    if (teacher.teacherInfo && Array.isArray(teacher.teacherInfo.subjects)) {
                        teacher.teacherInfo.subjects.forEach(subj => subjectSet.add(subj));
                    }
                });
                subjects = Array.from(subjectSet);
                console.log('Found subjects from Teachers:', subjects);
            } catch (err) {
                console.log('Could not fetch subjects from Teachers either:', err.message);
            }
        }
        
        // Fallback to default subjects if none found
        if (!subjects || subjects.length === 0) {
            subjects = ['Mathematics', 'Science', 'English', 'History', 'Biology', 'Geography', 'Physics', 'Chemistry'];
            console.log('Using default subjects list');
        }
        
        // Sort classes naturally (e.g., 1, 2, 10 instead of 1, 10, 2)
        allClasses.sort((a, b) => {
            const aNum = parseInt(a.match(/\d+/)?.[0] || a);
            const bNum = parseInt(b.match(/\d+/)?.[0] || b);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }
            return a.localeCompare(b);
        });
        
        console.log('Final classes list:', allClasses);
        
        res.json({
            classes: allClasses,
            subjects
        });
    } catch (error) {
        console.error('Error fetching teacher classes:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get sections for a specific class
export const getTeacherSections = async (req, res) => {
    try {
        const { class: className } = req.params;
        const User = mongoose.model('User');
        
        // Get sections from both students and teachers
        const studentSections = await User.find({ role: 'student', 'studentInfo.class': className }).distinct('studentInfo.section');
        const teacherSections = await User.find({ role: 'teacher', 'teacherInfo.classTeacher.class': className }).distinct('teacherInfo.classTeacher.section');
        
        // Combine and remove duplicates and empty values
        const allSections = Array.from(new Set([...studentSections, ...teacherSections])).filter(Boolean);
        
        // Sort sections alphabetically
        allSections.sort();
        
        res.json(allSections);
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get students for a specific class and section
export const getClassStudents = async (req, res) => {
    try {
        const { classId: className, section } = req.params;
        
        // Query the database for students in this class/section
        const User = mongoose.model('User');
        const students = await User.find({
            role: 'student',
            'studentInfo.class': className,
            'studentInfo.section': section
        }).select('name studentInfo.rollNumber');
        
        // Transform the data to match the expected format
        const formattedStudents = students.map(student => ({
            _id: student._id,
            name: student.name,
            studentInfo: { rollNumber: student.studentInfo.rollNumber }
        }));
        
        res.json(formattedStudents);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all teachers 
// @route   GET /api/teacher/all
// @access  Private
export const getAllTeachers = asyncHandler(async (req, res) => {
    try {
        console.log('Fetching all teachers');
        
        // Get all users with role 'teacher' with complete teacherInfo
        const teachers = await User.find({ role: 'teacher' })
            .select('_id name email teacherInfo')
            .sort('name');
        
        if (!teachers || teachers.length === 0) {
            console.log('No teachers found in the database');
            return res.status(404).json({
                message: "No teachers found"
            });
        }
        
        console.log(`Found ${teachers.length} teachers`);
        
        res.status(200).json({
            message: "Teachers retrieved successfully",
            users: teachers
        });
    } catch (error) {
        console.error('Error fetching teachers:', error);
        res.status(500).json({
            message: "Failed to retrieve teachers",
            error: error.message
        });
    }
});

// @desc    Mark teacher attendance (present/absent)
// @route   POST /api/teachers/attendance
// @access  Private (Teacher)
export const markAttendance = asyncHandler(async (req, res) => {
    try {
        const { status, reason } = req.body;
        const teacherName = req.user.name;
        
        // Validate status
        if (!status || !['present', 'absent'].includes(status)) {
            return res.status(400).json({
                message: "Please provide a valid status (present or absent)"
            });
        }
        
        // Get today's date (without time)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Check if attendance already marked for today
        const existingAttendance = await TeacherAttendance.findOne({
            teacherName,
            date: {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            }
        });
        
        if (existingAttendance) {
            // Update existing record
            existingAttendance.status = status;
            existingAttendance.reason = status === 'absent' ? reason || '' : '';
            await existingAttendance.save();
            
            res.status(200).json({
                message: "Attendance updated successfully",
                attendance: existingAttendance
            });
        } else {
            // Create new attendance record
            const attendance = await TeacherAttendance.create({
                teacherName,
                date: today,
                status,
                reason: status === 'absent' ? reason || '' : ''
            });
            
            res.status(201).json({
                message: "Attendance marked successfully",
                attendance
            });
        }
    } catch (error) {
        console.error(`Error marking teacher attendance:`, error);
        res.status(500).json({
            message: "Failed to mark attendance",
            error: error.message
        });
    }
});

// @desc    Get teacher's attendance history
// @route   GET /api/teachers/attendance
// @access  Private (Teacher)
export const getAttendanceHistory = asyncHandler(async (req, res) => {
    try {
        const teacherName = req.user.name;
        const { startDate, endDate } = req.query;
        
        const query = { teacherName };
        
        // Add date range if provided
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                query.date.$gte = new Date(startDate);
            }
            if (endDate) {
                const endDateObj = new Date(endDate);
                endDateObj.setHours(23, 59, 59, 999);
                query.date.$lte = endDateObj;
            }
        }
        
        const attendanceHistory = await TeacherAttendance.find(query)
            .sort({ date: -1 });
        
        res.status(200).json({
            message: "Attendance history retrieved successfully",
            attendanceHistory
        });
    } catch (error) {
        console.error(`Error fetching teacher attendance history:`, error);
        res.status(500).json({
            message: "Failed to retrieve attendance history",
            error: error.message
        });
    }
});

// @desc    Get all teachers' attendance for a specific date
// @route   GET /api/admin/teachers/attendance
// @access  Private (Admin)
export const getAllTeachersAttendance = asyncHandler(async (req, res) => {
    try {
        const { date } = req.query;
        
        // Default to today if date not provided
        const queryDate = date ? new Date(date) : new Date();
        queryDate.setHours(0, 0, 0, 0);
        
        // Get all teachers
        const teachers = await User.find({ role: 'teacher' })
            .select('name email');
        
        // Get attendance records for the date
        const attendanceRecords = await TeacherAttendance.find({
            date: {
                $gte: queryDate,
                $lt: new Date(queryDate.getTime() + 24 * 60 * 60 * 1000)
            }
        });
        
        // Create a map of teacher name to attendance status
        const attendanceMap = {};
        attendanceRecords.forEach(record => {
            attendanceMap[record.teacherName] = {
                status: record.status,
                reason: record.reason,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
                // Include the MongoDB document _id for reference
                recordId: record._id
            };
        });
        
        // Create response with all teachers and their attendance status
        const teachersWithAttendance = teachers.map(teacher => ({
            _id: teacher._id,
            name: teacher.name,
            email: teacher.email,
            attendance: attendanceMap[teacher.name] || { status: 'not_marked', reason: '' }
        }));
        
        res.status(200).json({
            message: "Teachers' attendance retrieved successfully",
            date: queryDate,
            teachers: teachersWithAttendance
        });
    } catch (error) {
        console.error(`Error fetching teachers' attendance:`, error);
        res.status(500).json({
            message: "Failed to retrieve teachers' attendance",
            error: error.message
        });
    }
});

