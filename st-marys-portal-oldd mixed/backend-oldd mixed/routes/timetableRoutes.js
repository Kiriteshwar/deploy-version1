import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
    getTimetable,
    getStudentTimetable,
    getTeacherTimetable,
    getAdminTimetable,
    createTimetableEntry,
    updateTimetableEntry,
    deleteTimetableEntry,
    bulkUpdateTimetable,
    getTeachersTimetable,
    getClassesAndSections,
    seedTimetable,
    uploadTimetable,
    downloadTemplate
} from '../controllers/timetableController.js';
import {
    markAttendance,
    getAttendanceHistory,
    getAllTeachersAttendance
} from '../controllers/teacherController.js';
import { protect, adminOnly, teacherOnly, studentOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `timetable-${Date.now()}${path.extname(file.originalname)}`);
    }
});

// Create upload middleware
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /xlsx|xls/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed!'));
        }
    }
});

// Routes for all users
router.get('/:class/:section', protect, getTimetable);

// Student-specific routes
router.get('/student', protect, studentOnly, getStudentTimetable);

// Teacher-specific routes
router.get('/teacher', protect, teacherOnly, getTeacherTimetable);

// Admin-only routes
router.get('/teachers', protect, adminOnly, getTeachersTimetable);
router.get('/classes', protect, adminOnly, getClassesAndSections);
router.get('/seed', protect, adminOnly, seedTimetable);
router.post('/', protect, adminOnly, createTimetableEntry);
router.put('/:id', protect, adminOnly, updateTimetableEntry);
router.delete('/:id', protect, adminOnly, deleteTimetableEntry);
router.post('/bulk', protect, adminOnly, bulkUpdateTimetable);

// Excel upload routes
router.post('/upload', protect, adminOnly, upload.single('timetable'), uploadTimetable);
router.get('/template', protect, adminOnly, downloadTemplate);

// Teacher attendance routes
router.post('/teacher/attendance', protect, markAttendance);
router.get('/teacher/attendance', protect, getAttendanceHistory);
router.get('/admin/teachers/attendance', protect, adminOnly, getAllTeachersAttendance);

export default router; 