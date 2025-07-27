import express from 'express';
const router = express.Router();
import { 
    getComplaint, 
    addComplaint, 
    getAllComplaints, 
    getComplaintById, 
    respondToComplaint, 
    assignComplaint, 
    updateComplaintStatus,
    deleteComplaint,
    addTeacherComplaint
} from "../controllers/complaintController.js";
import { protect, adminOnly, teacherOnly } from '../middleware/authMiddleware.js';

// Student routes
router.get('/student', protect, getComplaint); // Get student's own complaints
router.post('/', protect, addComplaint);       // Submit a new complaint

// Teacher complaint to admin route
router.post('/teacher', protect, teacherOnly, addTeacherComplaint); // Teacher submits complaint to admin

// Admin/teacher routes
router.get('/', protect, teacherOnly, getAllComplaints);  // Get all complaints with filters
router.get('/:id', protect, teacherOnly, getComplaintById);  // Get a specific complaint
router.post('/:id/respond', protect, teacherOnly, respondToComplaint);  // Add a response
router.put('/:id/assign', protect, adminOnly, assignComplaint);  // Assign to staff
router.put('/:id/status', protect, teacherOnly, updateComplaintStatus);  // Update status
router.delete('/:id', protect, teacherOnly, deleteComplaint);

export default router;
