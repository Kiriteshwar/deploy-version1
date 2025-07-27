import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
    createOrUpdateResult,
    getStudentResults,
    getResultsByExam,
    getClassResults,
    declareResult
} from '../controllers/resultsController.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Student routes
router.get('/student', getStudentResults); // Get own results

// Teacher routes
router.get('/exam/:examId', authorize(['admin', 'teacher']), getResultsByExam);
router.post('/class/:examId', authorize(['admin', 'teacher']), getClassResults);
router.post('/create', authorize(['admin', 'teacher']), createOrUpdateResult);

// Admin routes
router.post('/declare/:examId', authorize('admin'), declareResult);

export default router;
