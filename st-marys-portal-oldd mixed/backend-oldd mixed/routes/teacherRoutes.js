// // routes/teacherRoutes.js
// import express from 'express';
// const router = express.Router();
// import teacherController from '../controllers/teacherController.js';

// router.post('/register', teacherController.registerTeacher);
// router.post('/login', teacherController.loginTeacher);

// export default router;

import express from 'express';
import { protect, adminOnly, teacherOnly } from '../middleware/authMiddleware.js';
import { getTeacherClasses, getTeacherSections, getClassStudents, getAllTeachers, markAttendance, getAttendanceHistory, getAllTeachersAttendance, registerTeacher } from '../controllers/teacherController.js';
import User from '../models/userModel.js';
import expressAsyncHandler from 'express-async-handler';

const asyncHandler = expressAsyncHandler;

const router = express.Router();

// Get teacher's classes
router.get("/classes", protect, teacherOnly, getTeacherClasses);

// Get sections for a class
router.get("/sections/:class", protect, teacherOnly, getTeacherSections);

// Get students for a class/section
router.get("/students/:classId/:section", protect, teacherOnly, getClassStudents);

// Get all teachers
router.get("/all", protect, getAllTeachers);

// Get all teachers for the dropdown
router.get('/', protect, async (req, res) => {
    try {
        const teachers = await User.find({ role: 'teacher' })
            .select('name email')
            .sort('name');
        res.json(teachers);
    } catch (error) {
        console.error('Error fetching teachers:', error);
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
});

// Get all sections (for teacher visibility settings)
router.get('/sections', protect, async (req, res) => {
    try {
        // Find all unique sections in the system by checking student records
        const students = await User.find({ role: 'student' });
        const sections = new Set();
        
        students.forEach(student => {
            if (student.studentInfo && student.studentInfo.section) {
                sections.add(student.studentInfo.section);
            }
        });
        
        res.json(Array.from(sections).sort());
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({ error: 'Failed to fetch sections' });
    }
});

// Update a teacher's assigned notice sections (admin only)
router.put('/notice-sections/:teacherId', protect, adminOnly, async (req, res) => {
    try {
        const { noticeSections } = req.body;
        
        if (!Array.isArray(noticeSections)) {
            return res.status(400).json({ message: 'Notice sections must be an array' });
        }
        
        const teacher = await User.findById(req.params.teacherId);
        
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }
        
        if (teacher.role !== 'teacher') {
            return res.status(400).json({ message: 'User is not a teacher' });
        }
        
        // Update the teacher's notice sections
        if (!teacher.teacherInfo) {
            teacher.teacherInfo = { noticeSections };
        } else {
            teacher.teacherInfo.noticeSections = noticeSections;
        }
        
        await teacher.save();
        
        res.json({ 
            message: 'Teacher notice sections updated successfully',
            teacher: {
                id: teacher._id,
                name: teacher.name,
                noticeSections: teacher.teacherInfo.noticeSections
            }
        });
    } catch (error) {
        console.error('Error updating teacher notice sections:', error);
        res.status(500).json({ message: 'Failed to update teacher notice sections', error: error.message });
    }
});

// Get a teacher's assigned notice sections
router.get('/notice-sections/:teacherId', protect, async (req, res) => {
    try {
        // Admin can view any teacher's sections
        // Teachers can only view their own sections
        if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.teacherId) {
            return res.status(403).json({ message: 'Unauthorized to access this teacher\'s notice sections' });
        }
        
        const teacher = await User.findById(req.params.teacherId);
        
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }
        
        if (teacher.role !== 'teacher') {
            return res.status(400).json({ message: 'User is not a teacher' });
        }
        
        // Deduplicate and clean up noticeSections
        let noticeSections = Array.isArray(teacher.teacherInfo?.noticeSections) ? [...new Set(teacher.teacherInfo.noticeSections)] : [];
        // Get class teacher section and class
        const classTeacherSection = teacher.teacherInfo?.classTeacher?.section || null;
        const classTeacherClass = teacher.teacherInfo?.classTeacher?.class || null;
        // Remove class teacher section from noticeSections if present (will be shown separately)
        if (classTeacherClass && classTeacherSection) {
            const classTeacherCombo = `${classTeacherClass}-${classTeacherSection}`;
            noticeSections = noticeSections.filter(combo => combo !== classTeacherCombo);
        }
        res.json({
            teacherId: teacher._id,
            name: teacher.name,
            noticeSections,
            classTeacherSection,
            classTeacherClass
        });
    } catch (error) {
        console.error('Error fetching teacher notice sections:', error);
        res.status(500).json({ message: 'Failed to fetch teacher notice sections', error: error.message });
    }
});

// Public routes
router.post('/register', registerTeacher);

// Teacher attendance routes
router.post('/attendance', protect, teacherOnly, markAttendance);
router.get('/attendance', protect, teacherOnly, getAttendanceHistory);
router.get('/admin/attendance', protect, adminOnly, getAllTeachersAttendance);

export default router;

