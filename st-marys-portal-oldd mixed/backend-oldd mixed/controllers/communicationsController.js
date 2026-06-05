import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import CommunicationLog from '../models/communicationLogModel.js';
import Attendance from '../models/attendanceModel.js';
import { sendEmailNotification, sendBulkEmailNotification } from '../services/notificationService.js';

// @desc    Send individual message
// @route   POST /api/communications/send-individual
// @access  Private (Admin)
export const sendIndividualMessage = asyncHandler(async (req, res) => {
    const { recipientId, recipientType, subject, message } = req.body;

    if (!recipientId || !subject || !message) {
        return res.status(400).json({ success: false, message: 'recipientId, subject, and message are required' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
        return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    let email;
    let name = recipient.name;

    if (recipient.role === 'student') {
        email = recipient.studentInfo?.parentEmail;
        name = recipient.studentInfo?.guardianName || `Parent of ${recipient.name}`;
    } else if (recipient.role === 'teacher') {
        email = recipient.teacherInfo?.personalEmail || recipient.email;
    } else if (recipient.role === 'admin') {
        email = recipient.adminInfo?.personalEmail || recipient.email;
    }

    if (!email) {
        return res.status(400).json({ 
            success: false, 
            message: `No email found for ${recipient.role} "${recipient.name}". Please add their email first.` 
        });
    }

    const result = await sendEmailNotification({
        type: 'custom',
        data: {
            email,
            name,
            subject,
            message,
            studentRef: recipient.role === 'student' ? recipient._id : null,
            teacherRef: recipient.role === 'teacher' ? recipient._id : null,
            adminRef: recipient.role === 'admin' ? recipient._id : null
        },
        sentBy: req.user._id
    });

    res.json({
        success: result.success,
        message: result.success ? 'Message sent successfully' : 'Failed to send message',
        details: result
    });
});

// @desc    Send bulk messages by filters
// @route   POST /api/communications/send-bulk
// @access  Private (Admin)
export const sendBulkMessage = asyncHandler(async (req, res) => {
    const { subject, message, filters } = req.body;

    if (!subject || !message) {
        return res.status(400).json({ success: false, message: 'subject and message are required' });
    }

    // Build recipient query based on filters
    const query = { isActive: true };
    
    if (filters) {
        if (filters.role) {
            query.role = filters.role;
        }
        if (filters.role === 'student') {
            if (filters.class) query['studentInfo.class'] = filters.class;
            if (filters.section) query['studentInfo.section'] = filters.section;
            if (filters.studentStatus === 'former') query.isActive = false;
            if (filters.studentStatus === 'active') query.isActive = true;
        }
    }

    const recipients = await User.find(query).select('name role studentInfo teacherInfo adminInfo email');

    const emailRecipients = [];
    for (const recipient of recipients) {
        let email;
        let name = recipient.name;

        if (recipient.role === 'student') {
            email = recipient.studentInfo?.parentEmail;
            name = recipient.studentInfo?.guardianName || `Parent of ${recipient.name}`;
        } else if (recipient.role === 'teacher') {
            email = recipient.teacherInfo?.personalEmail || recipient.email;
        } else if (recipient.role === 'admin') {
            email = recipient.adminInfo?.personalEmail || recipient.email;
        }

        if (email) {
            emailRecipients.push({
                email,
                name,
                subject,
                message,
                studentRef: recipient.role === 'student' ? recipient._id : null,
                teacherRef: recipient.role === 'teacher' ? recipient._id : null,
                adminRef: recipient.role === 'admin' ? recipient._id : null
            });
        }
    }

    if (emailRecipients.length === 0) {
        return res.json({ success: false, message: 'No recipients found with email addresses' });
    }

    const results = await sendBulkEmailNotification({
        type: 'custom',
        recipients: emailRecipients,
        sentBy: req.user._id
    });

    const sentCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    res.json({
        success: true,
        message: `Sent ${sentCount} messages, ${failedCount} failed`,
        total: results.length,
        sent: sentCount,
        failed: failedCount
    });
});

// @desc    Send announcement
// @route   POST /api/communications/send-announcement
// @access  Private (Admin)
export const sendAnnouncement = asyncHandler(async (req, res) => {
    const { subject, message, sendToParents, sendToTeachers, sendToAdmins } = req.body;

    if (!subject || !message) {
        return res.status(400).json({ success: false, message: 'subject and message are required' });
    }

    const recipients = [];

    if (sendToParents) {
        const students = await User.find({ role: 'student', isActive: true })
            .select('name studentInfo');
        students.forEach(student => {
            if (student.studentInfo?.parentEmail) {
                recipients.push({
                    email: student.studentInfo.parentEmail,
                    name: student.studentInfo.guardianName || `Parent of ${student.name}`,
                    subject,
                    message,
                    studentRef: student._id
                });
            }
        });
    }

    if (sendToTeachers) {
        const teachers = await User.find({ role: 'teacher', isActive: true })
            .select('name teacherInfo email');
        teachers.forEach(teacher => {
            const email = teacher.teacherInfo?.personalEmail || teacher.email;
            if (email) {
                recipients.push({
                    email,
                    name: teacher.name,
                    subject,
                    message,
                    teacherRef: teacher._id
                });
            }
        });
    }

    if (sendToAdmins) {
        const admins = await User.find({ role: 'admin', isActive: true })
            .select('name adminInfo email');
        admins.forEach(admin => {
            const email = admin.adminInfo?.personalEmail || admin.email;
            if (email) {
                recipients.push({
                    email,
                    name: admin.name,
                    subject,
                    message,
                    adminRef: admin._id
                });
            }
        });
    }

    if (recipients.length === 0) {
        return res.json({ success: false, message: 'No recipients found with email addresses' });
    }

    const results = await sendBulkEmailNotification({
        type: 'announcement',
        recipients,
        sentBy: req.user._id
    });

    const sentCount = results.filter(r => r.success).length;

    res.json({
        success: true,
        message: `Announcement sent to ${sentCount} recipients`,
        total: recipients.length,
        sent: sentCount
    });
});

// @desc    Send absence notifications for today's absentees
// @route   POST /api/communications/send-absence-emails
// @access  Private (Admin)
export const sendAbsenceEmails = asyncHandler(async (req, res) => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));

    // Get absent students today (any period marked absent)
    const absenteeRecords = await Attendance.find({
        date: { $gte: start, $lt: end },
        status: 'Absent'
    }).populate('student');

    // Deduplicate by student
    const sentStudents = new Set();
    const results = [];

    for (const record of absenteeRecords) {
        const student = record.student;
        if (!student) continue;

        const studentId = student._id.toString();
        if (sentStudents.has(studentId)) continue;
        sentStudents.add(studentId);

        const parentEmail = student.studentInfo?.parentEmail;
        if (!parentEmail) {
            results.push({
                studentName: student.name,
                status: 'skipped',
                reason: 'No parent email'
            });
            continue;
        }

        const classInfo = `${student.studentInfo?.class || ''}-${student.studentInfo?.section || ''}`;

        const result = await sendEmailNotification({
            type: 'absence',
            data: {
                parentEmail,
                parentName: student.studentInfo?.guardianName,
                studentName: student.name,
                className: classInfo,
                date: now,
                reason: record.remarks || '',
                studentRef: student._id
            },
            sentBy: req.user._id
        });

        results.push({
            studentName: student.name,
            parentEmail,
            status: result.success ? 'sent' : 'failed',
            error: result.error || null
        });
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    res.json({
        success: true,
        message: `Absence emails sent to ${sentCount} parents, ${skippedCount} skipped (no email)`,
        total: results.length,
        sent: sentCount,
        skipped: skippedCount,
        details: results
    });
});

// @desc    Get communication dashboard stats
// @route   GET /api/communications/dashboard
// @access  Private (Admin)
export const getDashboardStats = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Emails sent today
    const emailsSentToday = await CommunicationLog.countDocuments({
        channel: 'email',
        status: 'sent',
        sentAt: { $gte: today, $lt: tomorrow }
    });

    // Pending notifications (failed today)
    const failedToday = await CommunicationLog.countDocuments({
        status: 'failed',
        sentAt: { $gte: today, $lt: tomorrow }
    });

    // Count birthdays today
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    // Find users whose dateOfBirth matches today (month and day)
    // MongoDB $expr allows comparing fields
    const studentsWithBirthdays = await User.find({
        role: 'student',
        isActive: true,
        $expr: {
            $and: [
                { $eq: [{ $month: '$dateOfBirth' }, todayMonth] },
                { $eq: [{ $dayOfMonth: '$dateOfBirth' }, todayDay] }
            ]
        }
    }).countDocuments();

    const teachersWithBirthdays = await User.find({
        role: 'teacher',
        isActive: true,
        $expr: {
            $and: [
                { $eq: [{ $month: '$dateOfBirth' }, todayMonth] },
                { $eq: [{ $dayOfMonth: '$dateOfBirth' }, todayDay] }
            ]
        }
    }).countDocuments();

    const adminsWithBirthdays = await User.find({
        role: 'admin',
        isActive: true,
        $expr: {
            $and: [
                { $eq: [{ $month: '$dateOfBirth' }, todayMonth] },
                { $eq: [{ $dayOfMonth: '$dateOfBirth' }, todayDay] }
            ]
        }
    }).countDocuments();

    const birthdaysToday = studentsWithBirthdays + teachersWithBirthdays + adminsWithBirthdays;

    // Fee defaulters count (approximate - students with balance > 0)
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });

    res.json({
        success: true,
        stats: {
            emailsSentToday,
            pendingNotifications: failedToday,
            birthdaysToday,
            totalStudents,
            studentsWithBirthdays,
            teachersWithBirthdays,
            adminsWithBirthdays
        }
    });
});

// @desc    Get communication logs with pagination
// @route   GET /api/communications/logs
// @access  Private (Admin)
export const getCommunicationLogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, type, status, channel } = req.query;
    const query = {};

    if (type) query.notificationType = type;
    if (status) query.status = status;
    if (channel) query.channel = channel;

    const total = await CommunicationLog.countDocuments(query);
    const logs = await CommunicationLog.find(query)
        .sort({ sentAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('sentBy', 'name email')
        .lean();

    res.json({
        success: true,
        logs,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc    Trigger birthday wishes for today
// @route   POST /api/communications/send-birthday-wishes
// @access  Private (Admin)
export const sendBirthdayWishes = asyncHandler(async (req, res) => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    // Find all users with birthdays today
    const students = await User.find({
        role: 'student',
        isActive: true,
        $expr: {
            $and: [
                { $eq: [{ $month: '$dateOfBirth' }, todayMonth] },
                { $eq: [{ $dayOfMonth: '$dateOfBirth' }, todayDay] }
            ]
        }
    }).select('name studentInfo');

    const teachers = await User.find({
        role: 'teacher',
        isActive: true,
        $expr: {
            $and: [
                { $eq: [{ $month: '$dateOfBirth' }, todayMonth] },
                { $eq: [{ $dayOfMonth: '$dateOfBirth' }, todayDay] }
            ]
        }
    }).select('name teacherInfo');

    const admins = await User.find({
        role: 'admin',
        isActive: true,
        $expr: {
            $and: [
                { $eq: [{ $month: '$dateOfBirth' }, todayMonth] },
                { $eq: [{ $dayOfMonth: '$dateOfBirth' }, todayDay] }
            ]
        }
    }).select('name adminInfo');

    const results = [];

    // Send birthday wishes to student parents
    for (const student of students) {
        if (student.studentInfo?.parentEmail) {
            const result = await sendEmailNotification({
                type: 'birthday',
                data: {
                    email: student.studentInfo.parentEmail,
                    name: student.name,
                    role: 'student',
                    subject: `Happy Birthday ${student.name}!`,
                    message: `Happy Birthday from St. Mary's School!`,
                    studentRef: student._id
                },
                sentBy: req.user._id
            });
            results.push({ name: student.name, role: 'student', email: student.studentInfo.parentEmail, status: result.success ? 'sent' : 'failed' });
        }
    }

    // Send birthday wishes to teachers
    for (const teacher of teachers) {
        const email = teacher.teacherInfo?.personalEmail || teacher.email;
        if (email) {
            const result = await sendEmailNotification({
                type: 'birthday',
                data: {
                    email,
                    name: teacher.name,
                    role: 'teacher',
                    subject: `Happy Birthday ${teacher.name}!`,
                    message: `Happy Birthday from St. Mary's School!`,
                    teacherRef: teacher._id
                },
                sentBy: req.user._id
            });
            results.push({ name: teacher.name, role: 'teacher', email, status: result.success ? 'sent' : 'failed' });
        }
    }

    // Send birthday wishes to admins
    for (const admin of admins) {
        const email = admin.adminInfo?.personalEmail || admin.email;
        if (email) {
            const result = await sendEmailNotification({
                type: 'birthday',
                data: {
                    email,
                    name: admin.name,
                    role: 'admin',
                    subject: `Happy Birthday ${admin.name}!`,
                    message: `Happy Birthday from St. Mary's School!`,
                    adminRef: admin._id
                },
                sentBy: req.user._id
            });
            results.push({ name: admin.name, role: 'admin', email, status: result.success ? 'sent' : 'failed' });
        }
    }

    res.json({
        success: true,
        message: `Birthday wishes processed for ${results.length} people`,
        total: results.length,
        sent: results.filter(r => r.status === 'sent').length,
        failed: results.filter(r => r.status === 'failed').length,
        details: results
    });
});

// @desc    Get all users for recipient selection
// @route   GET /api/communications/recipients
// @access  Private (Admin)
export const getRecipients = asyncHandler(async (req, res) => {
    const { role, class: className, section } = req.query;
    const query = { isActive: true };

    if (role) query.role = role;
    if (role === 'student' && className) query['studentInfo.class'] = className;
    if (role === 'student' && section) query['studentInfo.section'] = section;

    const users = await User.find(query)
        .select('name email role studentInfo teacherInfo adminInfo')
        .sort({ name: 1 });

    // Transform to include appropriate email
    const transformed = users.map(user => {
        let email;
        let displayName = user.name;

        if (user.role === 'student') {
            email = user.studentInfo?.parentEmail;
            displayName = `${user.name} (${user.studentInfo?.class}-${user.studentInfo?.section}) - Parent`;
        } else if (user.role === 'teacher') {
            email = user.teacherInfo?.personalEmail || user.email;
            displayName = `${user.name} (Teacher)`;
        } else if (user.role === 'admin') {
            email = user.adminInfo?.personalEmail || user.email;
            displayName = `${user.name} (Admin)`;
        }

        return {
            _id: user._id,
            name: displayName,
            email,
            role: user.role,
            class: user.studentInfo?.class,
            section: user.studentInfo?.section
        };
    });

    res.json({ success: true, users: transformed });
});