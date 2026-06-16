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
import { protect, teacherOnly, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Teacher routes
router.get("/teacher/classes", protect, teacherOnly, getTeacherClasses);

// Attendance routes
router.post("/mark", protect, teacherOnly, markAttendance);
router.get("/check", protect, teacherOnly, checkExistingAttendance);
router.get("/class/:class/:section", protect, teacherOnly, getClassAttendance);

// Admin attendance status & auto-send settings
router.get("/status", protect, adminOnly, getAttendanceStatus);
router.get("/auto-send-settings", protect, adminOnly, getAutoSendSettings);
router.post("/auto-send-settings", protect, adminOnly, setAutoSendSettings);

// Manual absence email sending by period
router.post("/send-absence-emails/:period", protect, adminOnly, sendManualAbsenceEmails);

// Messaging routes (admin only)
router.post("/test-whatsapp-period2", protect, adminOnly, testWhatsAppPeriod2);

// Auto-send control routes (admin only)
router.get("/auto-send-status", protect, adminOnly, getAutoSendStatus);
router.post("/auto-send-toggle", protect, adminOnly, toggleAutoSend);

router.get('/:studentId', protect, getAttendance);

export default router;