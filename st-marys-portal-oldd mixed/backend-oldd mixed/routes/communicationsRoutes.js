import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import {
    sendIndividualMessage,
    sendBulkMessage,
    sendAnnouncement,
    sendAbsenceEmails,
    getDashboardStats,
    getCommunicationLogs,
    sendBirthdayWishes,
    getRecipients
} from '../controllers/communicationsController.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(protect, adminOnly);

// Dashboard stats
router.get('/dashboard', getDashboardStats);

// Recipients list
router.get('/recipients', getRecipients);

// Communication logs
router.get('/logs', getCommunicationLogs);

// Send messages
router.post('/send-individual', sendIndividualMessage);
router.post('/send-bulk', sendBulkMessage);
router.post('/send-announcement', sendAnnouncement);

// Attendance integration
router.post('/send-absence-emails', sendAbsenceEmails);

// Birthday automation
router.post('/send-birthday-wishes', sendBirthdayWishes);

export default router;