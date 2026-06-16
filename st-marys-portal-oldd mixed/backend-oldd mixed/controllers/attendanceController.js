import asyncHandler from 'express-async-handler';
import axios from 'axios';
import Attendance from '../models/attendanceModel.js';
import User from '../models/userModel.js';
import Student from '../models/studentModel.js';
import CommunicationLog from '../models/communicationLogModel.js';
import { sendEmailNotification } from '../services/notificationService.js';

// Settings: auto-send after period 2 (ON) and period 6 (OFF)
let AUTO_SEND_PERIOD_2 = true;
let AUTO_SEND_PERIOD_6 = false;

// Track which periods have triggered auto-send today
const autoSendTriggered = new Map(); // 'YYYY-MM-DD-period2' or 'YYYY-MM-DD-period6' -> bool

// Helper: get today's date key
function getTodayKey() { return new Date().toISOString().split('T')[0]; }

// Helper: check if auto-send triggered for specific period today
function hasAutoSendTriggeredToday(period) {
    const key = `${getTodayKey()}-period${period}`;
    return autoSendTriggered.has(key);
}

// Helper: mark auto-send as triggered
function markAutoSendTriggered(period) {
    const key = `${getTodayKey()}-period${period}`;
    autoSendTriggered.set(key, true);
    console.log(`[Auto-Send] Marked auto-send as completed for period ${period}`);
}

// Helper: Check if a student already received an absence email today
async function hasAbsenceEmailBeenSentToday(studentId) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const existing = await CommunicationLog.findOne({
        studentRef: studentId,
        notificationType: 'absence',
        sentAt: { $gte: start, $lt: end }
    });
    return !!existing;
}

// Helper: Send absence email to parent with duplicate prevention
async function sendAbsenceEmailToParent(student, sentBy = null) {
    if (!student) return { status: 'skipped', reason: 'No student data' };

    const parentEmail = student.studentInfo?.parentEmail;
    if (!parentEmail) {
        return { studentName: student.name, status: 'skipped', reason: 'No parent email on file' };
    }

    const studentId = student._id.toString();

    // Check CommunicationLog for duplicate
    const alreadySent = await hasAbsenceEmailBeenSentToday(studentId);
    if (alreadySent) {
        return { studentName: student.name, status: 'duplicate_prevented', reason: 'Already sent today' };
    }

    const classInfo = `${student.studentInfo?.class || ''}-${student.studentInfo?.section || ''}`;

    try {
        const result = await sendEmailNotification({
            type: 'absence',
            data: {
                parentEmail,
                parentName: student.studentInfo?.guardianName,
                studentName: student.name,
                className: classInfo,
                date: new Date(),
                reason: '',
                studentRef: student._id
            },
            sentBy: sentBy || null
        });

        return {
            studentName: student.name,
            parentEmail,
            status: result.success ? 'sent' : 'failed',
            error: result.error || null
        };
    } catch (error) {
        return { studentName: student.name, parentEmail, status: 'failed', error: error.message };
    }
}

// Helper: Check if all classes have marked attendance for a period
async function allClassesMarkedAttendance(period, date) {
    try {
        console.log(`[Auto-Send] Checking if all classes marked attendance for period ${period}`);

        const classSectionCombos = await User.aggregate([
            { $match: { role: 'student', isActive: true } },
            { $group: { _id: { class: '$studentInfo.class', section: '$studentInfo.section' } } },
            { $match: { '_id.class': { $ne: null }, '_id.section': { $ne: null } } }
        ]);

        if (classSectionCombos.length === 0) return true;

        for (const combo of classSectionCombos) {
            const exists = await Attendance.exists({
                class: combo._id.class,
                section: combo._id.section,
                period: period,
                date: {
                    $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                    $lt: new Date(new Date(date).setHours(23, 59, 59, 999))
                }
            });
            if (!exists) return false;
        }
        return true;
    } catch (error) {
        console.error('[Auto-Send] Error:', error);
        return false;
    }
}

// Helper: Core logic - send absence emails for a specific period
async function processAbsenceEmailsForPeriod(period, triggerSource, sentBy = null) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    // Get all unique absent students today (any period, deduplicated)
    const allAbsentees = await Attendance.find({
        date: { $gte: start, $lt: end },
        status: 'Absent'
    }).populate({
        path: 'student',
        match: { role: 'student', isActive: true } // Only active students
    });

    // Deduplicate by student ID (only active students)
    const uniqueStudents = new Map();
    for (const record of allAbsentees) {
        // record.student will be null if populate match failed (inactive student)
        if (record.student && !uniqueStudents.has(record.student._id.toString())) {
            uniqueStudents.set(record.student._id.toString(), record.student);
        }
    }

    const results = [];
    for (const student of uniqueStudents.values()) {
        const result = await sendAbsenceEmailToParent(student, sentBy);
        results.push(result);
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const duplicates = results.filter(r => r.status === 'duplicate_prevented').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return { results, sent, skipped, duplicates, failed, total: results.length };
}

// @desc    Get attendance completion status
// @route   GET /api/attendance/status
// @access  Private (Admin)
export const getAttendanceStatus = asyncHandler(async (req, res) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // Get all class-section combos
    const classSectionCombos = await User.aggregate([
        { $match: { role: 'student', isActive: true } },
        { $group: { _id: { class: '$studentInfo.class', section: '$studentInfo.section' } } },
        { $match: { '_id.class': { $ne: null }, '_id.section': { $ne: null } } }
    ]);
    const totalClasses = classSectionCombos.length;

    // Check period 2 completion
    const period2Complete = await allClassesMarkedAttendance(2, now);
    // Check period 6 completion
    const period6Complete = await allClassesMarkedAttendance(6, now);

    // Count classes completed for each period
    let period2Completed = 0;
    let period6Completed = 0;
    for (const combo of classSectionCombos) {
        const p2 = await Attendance.exists({
            class: combo._id.class, section: combo._id.section, period: 2,
            date: { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
        });
        if (p2) period2Completed++;
        const p6 = await Attendance.exists({
            class: combo._id.class, section: combo._id.section, period: 6,
            date: { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
        });
        if (p6) period6Completed++;
    }

    // Count unique absentees today
    const absenteeRecords = await Attendance.find({
        date: { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) },
        status: 'Absent'
    }).distinct('student');
    const absenteesToday = absenteeRecords.length;

    // Count emails sent today (absence type)
    const emailsSentToday = await CommunicationLog.countDocuments({
        notificationType: 'absence',
        status: 'sent',
        sentAt: { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
    });

    // Count eligible but not yet notified (absentees without email today)
    let eligiblePending = 0;
    for (const studentId of absenteeRecords) {
        const alreadySent = await hasAbsenceEmailBeenSentToday(studentId);
        if (!alreadySent) {
            // Check if student has parent email
            const student = await User.findById(studentId).select('studentInfo');
            if (student?.studentInfo?.parentEmail) eligiblePending++;
        }
    }

    res.json({
        success: true,
        totalClasses,
        period2: { complete: period2Complete, completed: period2Completed, total: totalClasses },
        period6: { complete: period6Complete, completed: period6Completed, total: totalClasses },
        absenteesToday,
        emailsSentToday,
        eligiblePending,
        autoSendAfterPeriod2: AUTO_SEND_PERIOD_2,
        autoSendAfterPeriod6: AUTO_SEND_PERIOD_6,
        date: getTodayKey()
    });
});

// @desc    Get auto-send settings
// @route   GET /api/attendance/auto-send-settings
// @access  Private (Admin)
export const getAutoSendSettings = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        autoSendAfterPeriod2: AUTO_SEND_PERIOD_2,
        autoSendAfterPeriod6: AUTO_SEND_PERIOD_6
    });
});

// @desc    Toggle auto-send settings
// @route   POST /api/attendance/auto-send-settings
// @access  Private (Admin)
export const setAutoSendSettings = asyncHandler(async (req, res) => {
    const { autoSendAfterPeriod2, autoSendAfterPeriod6 } = req.body;

    if (typeof autoSendAfterPeriod2 === 'boolean') {
        AUTO_SEND_PERIOD_2 = autoSendAfterPeriod2;
    }
    if (typeof autoSendAfterPeriod6 === 'boolean') {
        AUTO_SEND_PERIOD_6 = autoSendAfterPeriod6;
    }

    console.log(`[Auto-Send] Settings updated: Period2=${AUTO_SEND_PERIOD_2}, Period6=${AUTO_SEND_PERIOD_6}`);

    res.json({
        success: true,
        autoSendAfterPeriod2: AUTO_SEND_PERIOD_2,
        autoSendAfterPeriod6: AUTO_SEND_PERIOD_6,
        message: `Auto-send settings updated: Period2=${AUTO_SEND_PERIOD_2 ? 'ON' : 'OFF'}, Period6=${AUTO_SEND_PERIOD_6 ? 'ON' : 'OFF'}`
    });
});

// @desc    Send absence emails for a specific period (manual)
// @route   POST /api/attendance/send-absence-emails/:period
// @access  Private (Admin)
export const sendManualAbsenceEmails = asyncHandler(async (req, res) => {
    const period = parseInt(req.params.period);
    if (![2, 6].includes(period)) {
        return res.status(400).json({ success: false, message: 'Period must be 2 or 6' });
    }

    const { results, sent, skipped, duplicates, failed, total } = await processAbsenceEmailsForPeriod(
        period, 'manual', req.user._id
    );

    res.json({
        success: true,
        message: `Period ${period}: ${sent} sent, ${skipped} skipped, ${duplicates} duplicates prevented, ${failed} failed`,
        period,
        sent,
        skipped,
        duplicates,
        failed,
        total,
        details: results
    });
});

// @desc    Check for existing attendance
// @route   GET /api/attendance/check
// @access  Private (Teachers only)
export const checkExistingAttendance = asyncHandler(async (req, res) => {
    try {
        const { date, period, class: className, section } = req.query;
        if (!date || !period || !className || !section) {
            const missingParams = [];
            if (!date) missingParams.push('date');
            if (!period) missingParams.push('period');
            if (!className) missingParams.push('class');
            if (!section) missingParams.push('section');
            return res.status(400).json({ message: `Missing required parameters: ${missingParams.join(', ')}` });
        }

        const searchDate = new Date(date);
        searchDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(searchDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const query = { date: { $gte: searchDate, $lt: nextDay }, period: parseInt(period), class: className, section: section };
        const existingRecords = await Attendance.findOne(query).populate('markedBy', 'name').lean();

        if (existingRecords) {
            return res.json({
                exists: true, message: 'Attendance already marked for this period',
                details: { subject: existingRecords.subject, markedBy: existingRecords.markedBy?.name || 'Unknown Teacher', date: existingRecords.date, period: existingRecords.period }
            });
        }
        return res.json({ exists: false, message: 'No existing attendance found' });
    } catch (error) {
        console.error('Error checking attendance:', error);
        res.status(500).json({ message: `Failed to check attendance: ${error.message}` });
    }
});

// @desc    Mark attendance for multiple students
// @route   POST /api/attendance/mark
// @access  Private (Teachers only)
export const markAttendance = asyncHandler(async (req, res) => {
    const { attendance, overwrite } = req.body;
    const teacherId = req.user._id;

    if (!Array.isArray(attendance) || attendance.length === 0) {
        res.status(400);
        throw new Error('Invalid attendance data format');
    }

    try {
        console.log(`Marking attendance for ${attendance.length} students, overwrite=${overwrite}`);

        if (!overwrite) {
            const studentIds = attendance.filter(record => record.status).map(record => record.student);
            if (studentIds.length === 0) return res.status(400).json({ message: 'No students with status provided' });

            const sampleRecord = attendance.find(record => record.status);
            const date = new Date(sampleRecord.date);
            const period = sampleRecord.period;

            const existingAttendance = await Attendance.findOne({ student: { $in: studentIds }, date, period })
                .populate('student', 'name').populate('markedBy', 'name');

            if (existingAttendance) {
                const studentName = existingAttendance.student?.name || 'Unknown';
                const teacherName = existingAttendance.markedBy?.name || 'Unknown';
                return res.status(409).json({
                    conflictFound: true,
                    message: `Attendance already marked for ${studentName} (Period ${period})`,
                    details: { student: existingAttendance.student, date, period, subject: existingAttendance.subject, markedBy: teacherName }
                });
            }
        }

        const attendanceRecords = [];
        const studentUpdateErrors = [];

        for (const record of attendance) {
            try {
                if (!record.status) continue;
                const student = await User.findOne({ _id: record.student, role: 'student', isActive: true });
                if (!student) { studentUpdateErrors.push(`Student not found: ${record.student}`); continue; }

                const existingRecord = await Attendance.findOne({ student: record.student, date: new Date(record.date), period: record.period });
                let attendanceRecord;
                if (existingRecord) {
                    existingRecord.status = record.status;
                    existingRecord.subject = record.subject;
                    existingRecord.remarks = record.remarks || existingRecord.remarks;
                    existingRecord.class = record.class;
                    existingRecord.section = record.section;
                    existingRecord.markedBy = teacherId;
                    attendanceRecord = await existingRecord.save();
                } else {
                    attendanceRecord = await Attendance.create({ ...record, markedBy: teacherId });
                }
                attendanceRecords.push(attendanceRecord);
            } catch (individualError) {
                if (individualError.code === 11000) {
                    try {
                        const updatedRecord = await Attendance.findOneAndUpdate(
                            { student: record.student, date: new Date(record.date), period: record.period },
                            { $set: { status: record.status, subject: record.subject, remarks: record.remarks, class: record.class, section: record.section, markedBy: teacherId } },
                            { new: true, upsert: true }
                        );
                        attendanceRecords.push(updatedRecord);
                        continue;
                    } catch (retryError) { console.error('Retry error:', retryError); }
                }
                studentUpdateErrors.push(`Error with student ${record.student}: ${individualError.message}`);
            }
        }

        if (attendanceRecords.length === 0 && studentUpdateErrors.length > 0) {
            return res.status(400).json({ message: `Failed to mark attendance: ${studentUpdateErrors[0]}`, errors: studentUpdateErrors });
        }

        res.status(201).json({
            message: 'Attendance marked successfully',
            records: attendanceRecords.length,
            warnings: studentUpdateErrors.length > 0 ? studentUpdateErrors : undefined
        });

        // AUTO-SEND CHECK - After attendance marking, check if triggers should fire
        const period = attendance.length > 0 ? attendance[0].period : null;
        if (period && [2, 6].includes(parseInt(period))) {
            const periodNum = parseInt(period);
            const date = attendance.length > 0 ? new Date(attendance[0].date) : new Date();

            // Check if auto-send is enabled for this period
            const autoEnabled = periodNum === 2 ? AUTO_SEND_PERIOD_2 : AUTO_SEND_PERIOD_6;
            if (!autoEnabled) {
                console.log(`[Auto-Send] Auto-send for period ${periodNum} is DISABLED, skipping`);
                return;
            }

            // Check if already triggered today
            if (hasAutoSendTriggeredToday(periodNum)) {
                console.log(`[Auto-Send] Already triggered for period ${periodNum} today, skipping`);
                return;
            }

            // Check if all classes marked
            const allMarked = await allClassesMarkedAttendance(periodNum, date);
            if (allMarked) {
                console.log(`[Auto-Send] All classes completed period ${periodNum}! Starting auto-send...`);
                markAutoSendTriggered(periodNum);

                const { sent, skipped, duplicates, failed, total } = await processAbsenceEmailsForPeriod(
                    periodNum, `period${periodNum}`, null
                );

                console.log(`[Auto-Send] Period ${periodNum} auto-send complete: ${sent} sent, ${skipped} skipped, ${duplicates} duplicates, ${failed} failed`);
            } else {
                console.log(`[Auto-Send] Not all classes marked period ${periodNum} yet`);
            }
        }

    } catch (error) {
        console.error('Error in markAttendance:', error);
        res.status(400);
        throw new Error(`Failed to mark attendance: ${error.message}`);
    }
});

// @desc    Get class attendance for a specific date
// @route   GET /api/attendance/class/:class/:section
// @access  Private (Teachers only)
export const getClassAttendance = asyncHandler(async (req, res) => {
    const { class: className, section } = req.params;
    const { date } = req.query;
    if (!date) { res.status(400); throw new Error('Date is required'); }
    const records = await Attendance.find({ class: className, section: section, date: new Date(date) }).populate('student', 'name');
    res.json(records);
});

// @desc    Get teacher's assigned classes
// @route   GET /api/attendance/teacher/classes
// @access  Private (Teachers only)
export const getTeacherClasses = asyncHandler(async (req, res) => {
    const studentClasses = await User.find({ role: 'student', isActive: true }).distinct('studentInfo.class');
    const teacherClasses = await User.find({ role: 'teacher', isActive: true }).distinct('teacherInfo.classTeacher.class');
    const classes = Array.from(new Set([...studentClasses, ...teacherClasses])).filter(Boolean);
    res.json({ classes });
});

// Get sections for a class
export const getSections = asyncHandler(async (req, res) => {
    const { class: className } = req.params;
    const studentSections = await User.find({ role: 'student', isActive: true, 'studentInfo.class': className }).distinct('studentInfo.section');
    const teacherSections = await User.find({ role: 'teacher', isActive: true, 'teacherInfo.classTeacher.class': className }).distinct('teacherInfo.classTeacher.section');
    const allSections = Array.from(new Set([...studentSections, ...teacherSections])).filter(Boolean);
    allSections.sort();
    res.json(allSections);
});

// Get students by class and section
export const getStudentsByClass = asyncHandler(async (req, res) => {
    const { class: className, section } = req.params;
    const students = await User.find({ role: 'student', isActive: true, 'studentInfo.class': className, 'studentInfo.section': section }).select('name studentInfo.rollNumber');
    res.json(students);
});

export const getAttendance = asyncHandler(async (req, res) => {
    console.log('Fetching attendance for student:', req.params.studentId);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Expires', '0');
    res.set('Pragma', 'no-cache');

    const { studentId } = req.params;
    
    // Ownership check: students can only view their own attendance
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
        return res.status(403).json({ message: 'Not authorized to view this attendance' });
    }
    
    try {
        const student = await User.findOne({ _id: studentId, role: 'student' });
        if (!student) return res.status(404).json({ message: 'Student not found', studentId });

        const records = await Attendance.find({ student: studentId }).sort({ date: -1, period: 1 }).lean();
        if (records.length === 0) {
            return res.json({ records: [], statistics: { totalDays: 0, presentDays: 0, absentDays: 0, noSessionDays: 0, attendancePercentage: 0 } });
        }

        const recordsByDate = {};
        records.forEach(record => {
            const dateKey = record.date.toISOString().split('T')[0];
            if (!recordsByDate[dateKey]) recordsByDate[dateKey] = [];
            const existingIndex = recordsByDate[dateKey].findIndex(r => r.period === record.period);
            if (existingIndex >= 0) {
                if (new Date(record.createdAt) > new Date(recordsByDate[dateKey][existingIndex].createdAt))
                    recordsByDate[dateKey][existingIndex] = record;
            } else {
                recordsByDate[dateKey].push(record);
            }
        });

        const processedRecords = [];
        Object.entries(recordsByDate).forEach(([date, dayRecords]) => {
            dayRecords.sort((a, b) => a.period - b.period);
            processedRecords.push(...dayRecords);
        });

        const totalDays = processedRecords.length;
        const presentDays = processedRecords.filter(r => r.status === 'Present').length;
        const absentDays = processedRecords.filter(r => r.status === 'Absent').length;
        const noSessionDays = processedRecords.filter(r => r.status === 'No Session').length;
        const actualSessionDays = totalDays - noSessionDays;
        const attendancePercentage = actualSessionDays > 0 ? (presentDays / actualSessionDays) * 100 : 0;

        res.json({
            records: processedRecords.map(record => ({ ...record, date: record.date.toISOString(), _id: record._id.toString() })),
            statistics: { totalDays, presentDays, absentDays, noSessionDays, attendancePercentage: Math.round(attendancePercentage * 100) / 100 }
        });
    } catch (error) {
        console.error('Error in getAttendance:', error);
        res.status(500).json({ message: 'Error fetching attendance records', error: error.message });
    }
});

// @desc    Get auto-send status (legacy, kept for compatibility)
// @route   GET /api/attendance/auto-send-status
// @access  Private (Admin)
export const getAutoSendStatus = asyncHandler(async (req, res) => {
    const today = getTodayKey();
    res.json({
        autoSendEnabled: AUTO_SEND_PERIOD_2,
        autoSendAfterPeriod2: AUTO_SEND_PERIOD_2,
        autoSendAfterPeriod6: AUTO_SEND_PERIOD_6,
        autoSendTriggeredToday: hasAutoSendTriggeredToday(2) || hasAutoSendTriggeredToday(6),
        date: today,
        timestamp: new Date().toISOString()
    });
});

// @desc    Toggle legacy auto-send (kept for compatibility)
// @route   POST /api/attendance/auto-send-toggle
// @access  Private (Admin)
export const toggleAutoSend = asyncHandler(async (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid input', message: 'enabled field must be a boolean' });
    }
    AUTO_SEND_PERIOD_2 = enabled;
    console.log(`[Auto-Send] Admin ${enabled ? 'ENABLED' : 'DISABLED'} period 2 auto-send`);
    res.json({
        success: true,
        autoSendEnabled: AUTO_SEND_PERIOD_2,
        autoSendAfterPeriod2: AUTO_SEND_PERIOD_2,
        autoSendAfterPeriod6: AUTO_SEND_PERIOD_6,
        message: `Period 2 auto-send is now ${AUTO_SEND_PERIOD_2 ? 'ENABLED' : 'DISABLED'}`
    });
});

// Legacy test endpoint (kept for compatibility)
export const testWhatsAppPeriod2 = asyncHandler(async (req, res) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const absentees = await Attendance.find({
        period: 2,
        date: { $gte: start, $lt: end },
        status: 'Absent'
    }).populate('student');

    res.json({
        total: absentees.length,
        sent: 0,
        failed: 0,
        details: absentees.map(r => ({
            studentName: r.student?.name || 'Unknown',
            status: 'counted'
        })),
        timestamp: new Date().toISOString()
    });
});