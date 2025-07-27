import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import {
    getTimetable,
    getAvailableTeachers,
    assignSubstitute,
    getTeacherAvailability,
    searchStudents,
    getStudentFees,
    makePayment,
    updateDiscount,
    searchPayments,
    // User management
    getUsers,
    addUser,
    updateUser,
    deleteUser
} from '../controllers/adminController.js';

const router = express.Router();

// Protect all routes with authentication and admin middleware
router.use(protect, adminOnly);

// Timetable routes
router.get('/timetable', getTimetable);
router.get('/available-teachers', getAvailableTeachers);
router.get('/teacher-availability', getTeacherAvailability);
router.post('/assign-substitute', assignSubstitute);

// Fee management routes
router.get('/fees/students', searchStudents);
router.get('/fees/student/:studentId', getStudentFees);
router.post('/fees/pay/:studentId', makePayment);
router.put('/fees/discount/:studentId', updateDiscount);
router.get('/fees/search', searchPayments);

// User management routes
router.get('/users', getUsers);
router.post('/users', addUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

export default router; 