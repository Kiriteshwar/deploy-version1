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
    getAttendanceStatus,
    getAutoSendSettings,
    setAutoSendSettings,
    sendManualAbsenceEmails
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

// Admin attendance status & auto-send settings
router.get("/status", protect, teacherOnly, getAttendanceStatus);
router.get("/auto-send-settings", protect, teacherOnly, getAutoSendSettings);
router.post("/auto-send-settings", protect, teacherOnly, setAutoSendSettings);

// Manual absence email sending by period
router.post("/send-absence-emails/:period", protect, teacherOnly, sendManualAbsenceEmails);

// Messaging routes (admin only)
router.post("/test-whatsapp-period2", protect, /*adminOnly*/ teacherOnly, testWhatsAppPeriod2);

// Auto-send control routes (admin only)
router.get("/auto-send-status", protect, /*adminOnly*/ teacherOnly, getAutoSendStatus);
router.post("/auto-send-toggle", protect, /*adminOnly*/ teacherOnly, toggleAutoSend);

export default router;