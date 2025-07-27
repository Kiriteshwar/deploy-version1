import express from 'express';
import { createHomework, getClassHomework, getTeacherHomework, updateHomework, deleteHomework, submitHomework, getHomeworkSubmissions } from '../controllers/homeworkController.js';
import { protect, teacherOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create new homework (teacher only)
router.post('/create', protect, teacherOnly, createHomework);

// Get homework for a specific class
router.get('/class/:classId', protect, getClassHomework);

// Get homework created by a teacher
router.get('/teacher', protect, teacherOnly, getTeacherHomework);

// Get submissions for a specific homework (teacher only)
router.get('/submissions/:homeworkId', protect, teacherOnly, getHomeworkSubmissions);

// Submit homework (students)
router.post('/submit/:homeworkId', protect, submitHomework);

// Update homework (teacher only)
router.put('/:homeworkId', protect, teacherOnly, updateHomework);

// Delete homework (teacher only)
router.delete('/:homeworkId', protect, teacherOnly, deleteHomework);

export default router;

