import express from "express";
// import attendanceController from "../controllers/attendanceController.js";
import { 
    markAttendance, 
    getClassAttendance,
    getTeacherClasses,
    checkExistingAttendance,
    getAttendance,
    testWhatsAppPeriod2
} from "../controllers/attendanceController.js";
import { protect, teacherOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Teacher routes
router.get("/teacher/classes", protect, teacherOnly, getTeacherClasses);

// Attendance routes
router.post("/mark", protect, teacherOnly, markAttendance);
router.get("/check", protect, teacherOnly, checkExistingAttendance);
router.get("/class/:class/:section", protect, teacherOnly, getClassAttendance);
router.get('/:studentId', protect, getAttendance);

// TEST: WhatsApp absent notification for period 2 (admin only)
router.post("/test-whatsapp-period2", protect, /*adminOnly*/ teacherOnly, testWhatsAppPeriod2);

export default router; // ✅ Convert `