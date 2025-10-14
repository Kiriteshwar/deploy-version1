import express from "express";
import { 
    markAttendance, 
    getClassAttendance,
    getTeacherClasses,
    checkExistingAttendance,
    getAttendance,
    testWhatsAppPeriod2,
    getAutoSendStatus,
    toggleAutoSend,
    getPeriod2Status,
    debugPeriod2,
    simplePeriod2Status
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

// Period 2 status and messaging routes (admin only)
router.get("/simple-period2", protect, /*adminOnly*/ teacherOnly, simplePeriod2Status);
router.get("/debug-period2", protect, /*adminOnly*/ teacherOnly, debugPeriod2);
router.get("/period2-status", protect, /*adminOnly*/ teacherOnly, getPeriod2Status);
router.post("/test-whatsapp-period2", protect, /*adminOnly*/ teacherOnly, testWhatsAppPeriod2);

// Auto-send control routes (admin only)
router.get("/auto-send-status", protect, /*adminOnly*/ teacherOnly, getAutoSendStatus);
router.post("/auto-send-toggle", protect, /*adminOnly*/ teacherOnly, toggleAutoSend);

export default router;
