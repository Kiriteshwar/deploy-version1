import asyncHandler from 'express-async-handler';
import axios from 'axios';
import Attendance from '../models/attendanceModel.js';
import User from '../models/userModel.js';
import Student from '../models/studentModel.js';

// Global setting to enable/disable auto-send (can be moved to database later)
let AUTO_SEND_ENABLED = true;

// Track which dates have already had auto-send triggered to prevent duplicates
const autoSendTriggered = new Set();

// Track which students have already received messages today to prevent duplicates
const messagesAlreadySent = new Map(); // Map: 'YYYY-MM-DD' -> Set of student IDs

// Helper function to get today's date key
function getTodayKey() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Helper function to check if message already sent to student today
function hasMessageBeenSent(studentId) {
    const today = getTodayKey();
    if (!messagesAlreadySent.has(today)) {
        messagesAlreadySent.set(today, new Set());
    }
    return messagesAlreadySent.get(today).has(studentId.toString());
}

// Helper function to mark message as sent to student
function markMessageSent(studentId, studentName) {
    const today = getTodayKey();
    if (!messagesAlreadySent.has(today)) {
        messagesAlreadySent.set(today, new Set());
    }
    messagesAlreadySent.get(today).add(studentId.toString());
    console.log(`[Duplicate-Prevention] Marked message sent for ${studentName} (${studentId}) on ${today}`);
}

// Helper function to check if auto-send already happened today
function hasAutoSendTriggeredToday() {
    const today = getTodayKey();
    return autoSendTriggered.has(today);
}

// Helper function to mark auto-send as triggered for today
function markAutoSendTriggered() {
    const today = getTodayKey();
    autoSendTriggered.add(today);
    console.log(`[Auto-Send] Marked auto-send as completed for ${today}`);
}

// Helper: Send WhatsApp message using MockAPI with duplicate prevention
async function sendWhatsAppMessage(phone, message, studentName = 'Unknown Student', studentId = null, skipDuplicateCheck = false) {
    console.log(`[WhatsApp] Starting to send message to ${phone} for ${studentName}`);
    
    // Check for duplicates unless explicitly skipped
    if (!skipDuplicateCheck && studentId && hasMessageBeenSent(studentId)) {
        console.log(`[Duplicate-Prevention] Message already sent to ${studentName} today, skipping`);
        return {
            studentName,
            guardianPhone: phone,
            message,
            status: 'duplicate_prevented',
            note: 'Message already sent today'
        };
    }
    
    try {
        // Use MockAPI for testing with essential data only
        const payload = {
            studentName: studentName,
            guardianPhone: phone,
            message: message,
            timestamp: new Date().toISOString(),
            status: 'sent'
        };
        
        console.log(`[WhatsApp] Payload to send:`, JSON.stringify(payload, null, 2));
        console.log(`[WhatsApp] Making POST request to MockAPI...`);
        
        const response = await axios.post('https://68eeacaab06cc802829b0af9.mockapi.io/messages', payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`[WhatsApp] SUCCESS! Response status: ${response.status}`);
        console.log(`[WhatsApp] Response data:`, JSON.stringify(response.data, null, 2));
        console.log(`[WhatsApp] Message sent to ${phone} for ${studentName}: ID ${response.data.id}`);
        
        // Mark message as sent to prevent duplicates
        if (studentId) {
            markMessageSent(studentId, studentName);
        }
        
        return response.data;
    } catch (error) {
        console.error(`[WhatsApp] ERROR sending to ${phone}:`, error.message);
        console.error(`[WhatsApp] Full error:`, error);
        
        // Still log to console as fallback
        console.log(`[WhatsApp] Fallback - Would send to ${phone}: ${message}`);
        
        // Return error data but don't throw
        return { 
            studentName, 
            guardianPhone: phone, 
            message, 
            status: 'failed',
            error: error.message 
        };
    }
}

// Helper: Check if all classes have marked attendance for a period
async function allClassesMarkedAttendance(period, date) {
    try {
        console.log(`[Auto-Send] Checking if all classes marked attendance for period ${period}`);
        
        // Get all unique class-section combinations that actually exist in the system
        const classSectionCombos = await User.aggregate([
            { $match: { role: 'student' } },
            { 
                $group: {
                    _id: {
                        class: '$studentInfo.class',
                        section: '$studentInfo.section'
                    }
                }
            },
            { 
                $match: {
                    '_id.class': { $ne: null },
                    '_id.section': { $ne: null }
                }
            }
        ]);
        
        console.log(`[Auto-Send] Found ${classSectionCombos.length} class-section combinations:`, 
            classSectionCombos.map(c => `${c._id.class}-${c._id.section}`));
        
        // If no class-section combinations found, return true (no classes to check)
        if (classSectionCombos.length === 0) {
            console.log('[Auto-Send] No class-section combinations found, returning true');
            return true;
        }
        
        // For each actual class-section combination, check if attendance exists for this period/date
        for (const combo of classSectionCombos) {
            const className = combo._id.class;
            const sectionName = combo._id.section;
            
            const exists = await Attendance.exists({
                class: className,
                section: sectionName,
                period: period,
                date: {
                    $gte: new Date(new Date(date).setHours(0,0,0,0)),
                    $lt: new Date(new Date(date).setHours(23,59,59,999))
                }
            });
            
            console.log(`[Auto-Send] Checking ${className}-${sectionName}, period ${period}:`, exists ? 'MARKED' : 'NOT MARKED');
            
            if (!exists) {
                console.log(`[Auto-Send] Missing attendance for ${className}-${sectionName}, period ${period}`);
                return false;
            }
        }
        
        console.log('[Auto-Send] All class-section combinations have marked attendance for period', period);
        return true;
        
    } catch (error) {
        console.error('[Auto-Send] Error in allClassesMarkedAttendance:', error);
        return false;
    }
}

// @desc    Check for existing attendance
// @route   GET /api/attendance/check
// @access  Private (Teachers only)
export const checkExistingAttendance = asyncHandler(async (req, res) => {
    try {
        const { date, period, class: className, section } = req.query;

        // Validate required parameters
        if (!date || !period || !className || !section) {
            const missingParams = [];
            if (!date) missingParams.push('date');
            if (!period) missingParams.push('period');
            if (!className) missingParams.push('class');
            if (!section) missingParams.push('section');

            return res.status(400).json({
                message: `Missing required parameters: ${missingParams.join(', ')}`
            });
        }

        // Check existing attendance
        const searchDate = new Date(date);
        searchDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(searchDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const query = {
            date: {
                $gte: searchDate,
                $lt: nextDay
            },
            period: parseInt(period),
            class: className,
            section: section
        };

        const existingRecords = await Attendance.findOne(query)
            .populate('markedBy', 'name')
            .lean();

        if (existingRecords) {
            return res.json({
                exists: true,
                message: 'Attendance already marked for this period',
                details: {
                    subject: existingRecords.subject,
                    markedBy: existingRecords.markedBy?.name || 'Unknown Teacher',
                    date: existingRecords.date,
                    period: existingRecords.period
                }
            });
        }

        return res.json({
            exists: false,
            message: 'No existing attendance found'
        });

    } catch (error) {
        console.error('Error checking attendance:', error);
        res.status(500).json({
            message: `Failed to check attendance: ${error.message}`
        });
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
        
        // Skip conflict check if overwrite is explicitly set to true
        if (!overwrite) {
            console.log('Checking for existing attendance records for any student...');
            
            // Get all student IDs that have a status
            const studentIds = attendance
                .filter(record => record.status) // Only consider records with a status
                .map(record => record.student);
                
            if (studentIds.length === 0) {
                return res.status(400).json({
                    message: 'No students with status provided'
                });
            }
            
            // Get a sample record to extract date and period
            const sampleRecord = attendance.find(record => record.status);
            const date = new Date(sampleRecord.date);
            const period = sampleRecord.period;
            
            console.log(`Checking for date=${date}, period=${period}, checking ${studentIds.length} students`);
            
            // Check if ANY of these students already have attendance marked for this date and period
            const existingAttendance = await Attendance.findOne({
                student: { $in: studentIds },
                date: date,
                period: period
            }).populate('student', 'name')
              .populate('markedBy', 'name');
            
            if (existingAttendance) {
                const studentName = existingAttendance.student ? existingAttendance.student.name : 'Unknown Student';
                const teacherName = existingAttendance.markedBy ? existingAttendance.markedBy.name : 'Unknown Teacher';
                
                console.log(`Found existing attendance for ${studentName}, marked by ${teacherName}`);
                
                return res.status(409).json({
                    conflictFound: true,
                    message: `Attendance already marked for ${studentName} (Period ${period}, ${existingAttendance.subject})`,
                    details: {
                        student: existingAttendance.student,
                        date: existingAttendance.date,
                        period: existingAttendance.period,
                        subject: existingAttendance.subject,
                        markedBy: teacherName
                    }
                });
            }
            
            console.log('No existing attendance found for any student. Proceeding with creating new records.');
        }
        
        console.log('Proceeding with attendance marking, no conflicts found or overwrite enabled');
        
        // Proceed with creating/updating attendance records
        const attendanceRecords = [];
        const studentUpdateErrors = [];
        
        for (const record of attendance) {
            try {
                // Skip empty records
                if (!record.status) {
                    console.log(`Skipping record with no status for student ID ${record.student}`);
                    continue;
                }
                
                // Validate student exists
                const student = await User.findOne({ 
                    _id: record.student, 
                    role: 'student'
                });

                if (!student) {
                    console.log(`Student not found: ${record.student}`);
                    studentUpdateErrors.push(`Student not found: ${record.student}`);
                    continue;
                }

                console.log(`Processing student ${student.name}, ID=${student._id}`);
                
                // Always check for existing record regardless of overwrite flag
                const existingRecord = await Attendance.findOne({
                    student: record.student,
                    date: new Date(record.date),
                    period: record.period
                });
                
                let attendanceRecord;
                
                if (existingRecord) {
                    // Update existing record
                    console.log(`Updating existing record for ${student.name}, period ${record.period}`);
                    existingRecord.status = record.status;
                    existingRecord.subject = record.subject;
                    existingRecord.remarks = record.remarks || existingRecord.remarks;
                    existingRecord.class = record.class;
                    existingRecord.section = record.section;
                    existingRecord.markedBy = teacherId;
                    attendanceRecord = await existingRecord.save();
                } else {
                    // Create new record
                    console.log(`Creating new attendance record for ${student.name}, period ${record.period}`);
                    attendanceRecord = await Attendance.create({
                        ...record,
                        markedBy: teacherId
                    });
                }
                
                attendanceRecords.push(attendanceRecord);
                console.log(`Successfully processed attendance for ${student.name}`);
            } catch (individualError) {
                // Handle duplicate key error (E11000) more gracefully
                if (individualError.code === 11000) {
                    console.log(`Duplicate record detected for student ${record.student}, period ${record.period}`);
                    // Try again with a findOneAndUpdate approach
                    try {
                        console.log('Attempting to update existing record instead');
                        const updatedRecord = await Attendance.findOneAndUpdate(
                            {
                                student: record.student,
                                date: new Date(record.date),
                                period: record.period
                            },
                            {
                                $set: {
                                    status: record.status,
                                    subject: record.subject,
                                    remarks: record.remarks,
                                    class: record.class,
                                    section: record.section,
                                    markedBy: teacherId
                                }
                            },
                            { new: true, upsert: true }
                        );
                        attendanceRecords.push(updatedRecord);
                        console.log('Successfully updated record using findOneAndUpdate');
                        continue;
                    } catch (retryError) {
                        console.error('Error during retry operation:', retryError);
                    }
                }
                
                console.error(`Error processing student ${record.student}:`, individualError);
                studentUpdateErrors.push(`Error with student ${record.student}: ${individualError.message}`);
            }
        }

        if (attendanceRecords.length === 0 && studentUpdateErrors.length > 0) {
            // If all updates failed, return an error
            return res.status(400).json({
                message: `Failed to mark attendance: ${studentUpdateErrors[0]}`,
                errors: studentUpdateErrors
            });
        }

        console.log(`Successfully processed ${attendanceRecords.length} attendance records`);
        if (studentUpdateErrors.length > 0) {
            console.log(`Encountered ${studentUpdateErrors.length} errors during processing`);
        }
        
        res.status(201).json({
            message: 'Attendance marked successfully',
            records: attendanceRecords.length,
            warnings: studentUpdateErrors.length > 0 ? studentUpdateErrors : undefined
        });
        
        // After marking attendance for this class/period, check if all classes have marked period 2
        if (parseInt(period) === 2) {
            console.log('[Auto-Send] Period 2 attendance marked, checking auto-send conditions...');
            
            // Check if auto-send is enabled
            if (!AUTO_SEND_ENABLED) {
                console.log('[Auto-Send] Auto-send is DISABLED, skipping auto-send process');
                return; // Exit early if auto-send is disabled
            }
            
            // Check if auto-send already triggered today
            if (hasAutoSendTriggeredToday()) {
                console.log('[Auto-Send] Auto-send already triggered today, skipping to prevent duplicates');
                return; // Exit early if already triggered today
            }
            
            try {
                const allMarked = await allClassesMarkedAttendance(2, new Date(date));
                
                if (allMarked) {
                    console.log('[Auto-Send] All classes have marked period 2 attendance! Starting auto-send process...');
                    
                    // Mark auto-send as triggered to prevent multiple executions
                    markAutoSendTriggered();
                    
                    // Get all absentees for period 2 today
                    const absentees = await Attendance.find({
                        period: 2,
                        date: {
                            $gte: new Date(new Date(date).setHours(0,0,0,0)),
                            $lt: new Date(new Date(date).setHours(23,59,59,999))
                        },
                        status: 'Absent'
                    }).populate('student');
                    
                    console.log(`[Auto-Send] Found ${absentees.length} absent students for period 2`);
                    
                    let successCount = 0;
                    let failureCount = 0;
                    let duplicateCount = 0;
                    
                    for (const record of absentees) {
                        let studentName = record.student?.name || 'Student';
                        let studentId = record.student?._id;
                        let guardianPhone = record.student?.studentInfo?.guardianPhone || record.student?.phone;
                        
                        if (guardianPhone && studentId) {
                            const message = `Dear Parent, your child ${studentName} was marked absent for period 2 today.`;
                            try {
                                const result = await sendWhatsAppMessage(guardianPhone, message, studentName, studentId);
                                if (result.status === 'duplicate_prevented') {
                                    duplicateCount++;
                                    console.log(`[Auto-Send] Duplicate prevented for ${studentName}`);
                                } else {
                                    successCount++;
                                    console.log(`[Auto-Send] Message sent to parent of ${studentName}`);
                                }
                            } catch (error) {
                                failureCount++;
                                console.error(`[Auto-Send] Failed to send message for ${studentName}:`, error.message);
                            }
                        } else {
                            console.log(`[Auto-Send] No phone number or student ID for ${studentName}, skipping`);
                        }
                    }
                    
                    console.log(`[Auto-Send] Auto-send completed: ${successCount} sent, ${failureCount} failed, ${duplicateCount} duplicates prevented`);
                } else {
                    console.log('[Auto-Send] Not all classes have marked period 2 attendance yet, auto-send not triggered');
                }
            } catch (error) {
                console.error('[Auto-Send] Error during auto-send process:', error);
            }
        } else {
            console.log(`[Auto-Send] Period ${period} marked, auto-send only works for period 2`);
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

    if (!date) {
        res.status(400);
        throw new Error('Date is required');
    }

    // Get attendance for all students in the class
    const records = await Attendance.find({
        class: className,
        section: section,
        date: new Date(date)
    }).populate('student', 'name');

    res.json(records);
});

// @desc    Get teacher's assigned classes
// @route   GET /api/attendance/teacher/classes
// @access  Private (Teachers only)
export const getTeacherClasses = asyncHandler(async (req, res) => {
    // Only include classes that are currently assigned to at least one student or teacher
    const studentClasses = await User.find({ role: 'student' }).distinct('studentInfo.class');
    const teacherClasses = await User.find({ role: 'teacher' }).distinct('teacherInfo.classTeacher.class');
    const classes = Array.from(new Set([...studentClasses, ...teacherClasses])).filter(Boolean);

    // Optionally, you can also update sections/subjects logic similarly if needed
    res.json({
        classes
    });
});

// Get sections for a class
export const getSections = asyncHandler(async (req, res) => {
    const { class: className } = req.params;

    // Get sections from both students and teachers
    const studentSections = await User.find({ role: 'student', 'studentInfo.class': className }).distinct('studentInfo.section');
    const teacherSections = await User.find({ role: 'teacher', 'teacherInfo.classTeacher.class': className }).distinct('teacherInfo.classTeacher.section');
    
    // Combine and remove duplicates and empty values
    const allSections = Array.from(new Set([...studentSections, ...teacherSections])).filter(Boolean);
    
    // Sort sections alphabetically
    allSections.sort();
    
    res.json(allSections);
});

// Get students by class and section
export const getStudentsByClass = asyncHandler(async (req, res) => {
    const { class: className, section } = req.params;
    const students = await User.find({
        role: 'student',
        'studentInfo.class': className,
        'studentInfo.section': section
    }).select('name studentInfo.rollNumber');
    res.json(students);
});

export const getAttendance = asyncHandler(async (req, res) => {
    console.log('Fetching attendance for student:', req.params.studentId);

    // Set cache control headers
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Expires', '0');
    res.set('Pragma', 'no-cache');

    const { studentId } = req.params;

    try {
        // Validate student exists
        const student = await User.findOne({ _id: studentId, role: 'student' });
        if (!student) {
            console.log('Student not found:', studentId);
            return res.status(404).json({
                message: 'Student not found',
                studentId
            });
        }
        console.log('Found student:', student);

        // Get all records for the student
        const records = await Attendance.find({ student: studentId })
            .sort({ date: -1, period: 1 })
            .lean();

        console.log(`Found ${records.length} attendance records`);

        if (records.length === 0) {
            return res.json({
                records: [],
                statistics: {
                    totalDays: 0,
                    presentDays: 0,
                    absentDays: 0,
                    noSessionDays: 0,
                    attendancePercentage: 0
                }
            });
        }

        // Group records by date
        const recordsByDate = {};
        records.forEach(record => {
            const dateKey = record.date.toISOString().split('T')[0];
            if (!recordsByDate[dateKey]) {
                recordsByDate[dateKey] = [];
            }
            
            // Check for duplicate periods and only keep the most recent one (by createdAt)
            const existingPeriodIndex = recordsByDate[dateKey].findIndex(r => r.period === record.period);
            
            if (existingPeriodIndex >= 0) {
                const existingRecord = recordsByDate[dateKey][existingPeriodIndex];
                // If the current record is more recent, replace the existing one
                if (new Date(record.createdAt) > new Date(existingRecord.createdAt)) {
                    recordsByDate[dateKey][existingPeriodIndex] = record;
                }
                // Otherwise keep the existing record (more recent one)
            } else {
                // No duplicate, add the record
                recordsByDate[dateKey].push(record);
            }
        });

        // Process records for each date
        const processedRecords = [];
        Object.entries(recordsByDate).forEach(([date, dayRecords]) => {
            // Sort by period
            dayRecords.sort((a, b) => a.period - b.period);
            processedRecords.push(...dayRecords);
        });

        // Calculate statistics
        const totalDays = processedRecords.length;
        const presentDays = processedRecords.filter(r => r.status === 'Present').length;
        const absentDays = processedRecords.filter(r => r.status === 'Absent').length;
        const noSessionDays = processedRecords.filter(r => r.status === 'No Session').length;
        
        const actualSessionDays = totalDays - noSessionDays;
        const attendancePercentage = actualSessionDays > 0 
            ? (presentDays / actualSessionDays) * 100
            : 0;

        const response = {
            records: processedRecords.map(record => ({
                ...record,
                date: record.date.toISOString(),  // Ensure consistent date format
                _id: record._id.toString()  // Convert ObjectId to string
            })),
            statistics: {
                totalDays,
                presentDays,
                absentDays,
                noSessionDays,
                attendancePercentage: Math.round(attendancePercentage * 100) / 100
            }
        };

        // Add debug information
        console.log('Response statistics:', response.statistics);
        console.log('First few records:', response.records.slice(0, 3));

        res.json(response);

    } catch (error) {
        console.error('Error in getAttendance:', error);
        // Send more detailed error information
        res.status(500).json({
            message: 'Error fetching attendance records',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// TEST ENDPOINT: Trigger WhatsApp for all period 2 absentees today
// @route   POST /api/attendance/test-whatsapp-period2
// @access  Private (Admin only, for testing)
export const testWhatsAppPeriod2 = asyncHandler(async (req, res) => {
    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth();
    const utcDate = now.getUTCDate();

    const start = new Date(Date.UTC(utcYear, utcMonth, utcDate, 0, 0, 0));
    const end = new Date(Date.UTC(utcYear, utcMonth, utcDate + 1, 0, 0, 0));

    // Get absentees for period 2 today
    const absentees = await Attendance.find({
        period: 2,
        date: { $gte: start, $lt: end },
        status: 'Absent'
    }).populate('student');
    
    let results = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const record of absentees) {
        let studentName = record.student?.name || 'Student';
        let studentId = record.student?._id;
        let guardianPhone = record.student?.studentInfo?.guardianPhone || record.student?.phone;
        if (guardianPhone && studentId) {
            const message = `Dear Parent, your child ${studentName} was marked absent for period 2 today.`;
            try {
                const result = await sendWhatsAppMessage(guardianPhone, message, studentName, studentId);
                results.push({ 
                    studentName, 
                    guardianPhone, 
                    status: result.status || 'sent',
                    messageId: result.id,
                    note: result.note || null
                });
                if (result.status === 'duplicate_prevented') {
                    // Count duplicates as neither success nor failure, just info
                    console.log(`[Manual-Send] Duplicate prevented for ${studentName}`);
                } else {
                    successCount++;
                }
            } catch (error) {
                results.push({ 
                    studentName, 
                    guardianPhone, 
                    status: 'failed',
                    error: error.message
                });
                failureCount++;
            }
        } else {
            console.log(`[Manual-Send] No phone number or student ID for ${studentName}, skipping`);
        }
    }
    
    res.json({ 
        sent: successCount,
        failed: failureCount,
        total: absentees.length,
        details: results,
        timestamp: new Date().toISOString()
    });
});

// @desc    Get auto-send status
// @route   GET /api/attendance/auto-send-status
// @access  Private (Admin only)
export const getAutoSendStatus = asyncHandler(async (req, res) => {
    const today = getTodayKey();
    res.json({
        autoSendEnabled: AUTO_SEND_ENABLED,
        autoSendTriggeredToday: hasAutoSendTriggeredToday(),
        messagesAlreadySentToday: messagesAlreadySent.get(today)?.size || 0,
        date: today,
        timestamp: new Date().toISOString()
    });
});

// @desc    Enable/disable auto-send
// @route   POST /api/attendance/auto-send-toggle
// @access  Private (Admin only)
export const toggleAutoSend = asyncHandler(async (req, res) => {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({
            error: 'Invalid input',
            message: 'enabled field must be a boolean (true or false)'
        });
    }
    
    AUTO_SEND_ENABLED = enabled;
    console.log(`[Auto-Send] Admin ${enabled ? 'ENABLED' : 'DISABLED'} auto-send functionality`);
    
    res.json({
        success: true,
        autoSendEnabled: AUTO_SEND_ENABLED,
        message: `Auto-send is now ${AUTO_SEND_ENABLED ? 'ENABLED' : 'DISABLED'}`,
        timestamp: new Date().toISOString()
    });
});
