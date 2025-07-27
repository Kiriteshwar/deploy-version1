import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
    createExam,
    getExams,
    getExamById,
    updateExam,
    deleteExam,
    getActiveExams,
    getUpcomingExams,
    getCompletedExams
} from '../controllers/examController.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Routes accessible by teachers and admin
router.route('/')
    .get(authorize(['admin', 'teacher']), getExams)
    .post(authorize(['admin', 'teacher']), createExam);

router.route('/active')
    .get(authorize(['admin', 'teacher', 'student']), getActiveExams);

router.route('/upcoming')
    .get(authorize(['admin', 'teacher', 'student']), getUpcomingExams);

router.route('/completed')
    .get(authorize(['admin', 'teacher', 'student']), getCompletedExams);

router.route('/:id')
    .get(authorize(['admin', 'teacher']), getExamById)
    .put(authorize(['admin', 'teacher']), updateExam)
    .delete(authorize('admin'), deleteExam);

export default router;

