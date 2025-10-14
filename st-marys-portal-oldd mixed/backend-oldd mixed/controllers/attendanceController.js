import asyncHandler from 'express-async-handler';
import Attendance from '../models/attendanceModel.js';
import User from '../models/userModel.js';
import Student from '../models/studentModel.js';

// Helper: Send WhatsApp message using MockAPI
async function sendWhatsAppMessage(phone, message, studentName = 'Unknown Student') {
    try {
        // Use MockAPI for testing with essential data only
        const axios = (await import('axios')).default;
        const response = await axios.post('https://68eeacaab06cc802829b0af9.mockapi.io/messages', {
            studentName: studentName,
            guardianPhone: phone,
            message: message,
            timestamp: new Date().toISOString(),
            status: 'sent'
        });
        console.log(`[WhatsApp] Message sent to ${phone} for ${studentName}: ${response.data.id}`);
        return response.data;
    } catch (error) {
        console.error(`[WhatsApp] Failed to send to ${phone}:`, error.message);
        // Still log to console as fallback
        console.log(`[WhatsApp] Fallback - Sending to ${phone}: ${message}`);
        return { studentName, guardianPhone: phone, message, status: 'failed' };
    }
}

// Helper: Check if all classes have marked attendance for a period
async function allClassesMarkedAttendance(period, date) {
    // Get all classes/sections
    const users = await User.find({ role: 'student' }).distinct('studentInfo.class');
    const sections = await User.find({ role: 'student' }).distinct('studentInfo.section');
    const classes = users.filter(Boolean);
    const allSections = sections.filter(Boolean);
    // For each class-section, check if at least one attendance record exists for this period/date
    for (const className of classes) {
        for (const section of allSections) {
            const exists = await Attendance.exists({
                class: className,
                section: section,
                period: period,
                date: {
                    $gte: new Date(date.setHours(0,0,0,0)),
                    $lt: new Date(date.setHours(23,59,59,999))
                }
            });
            if (!exists) {
                return false;
            }
        }
    }
    return true;
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
            const allMarked = await allClassesMarkedAttendance(2, new Date(date));
            if (allMarked) {
                // Get all absentees for period 2 today
                const absentees = await Attendance.find({
                    period: 2,
                    date: {
                        $gte: new Date(date.setHours(0,0,0,0)),
                        $lt: new Date(date.setHours(23,59,59,999))
                    },
                    status: 'Absent'
                }).populate('student');
                for (const record of absentees) {
                    let studentName = record.student?.name || 'Student';
                    let guardianPhone = record.student?.studentInfo?.guardianPhone || record.student?.phone;
                    if (guardianPhone) {
                        const message = `Dear Parent, your child ${studentName} was marked absent for today.`;
                        // const message = `Dear Parent,Please note ${studentName} was absent today.Thank you.`;
                        await sendWhatsAppMessage(guardianPhone, message, studentName);
                    }
                }
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
        let guardianPhone = record.student?.studentInfo?.guardianPhone || record.student?.phone;
        if (guardianPhone) {
            const message = `Dear Parent, your child ${studentName} was marked absent for period 2 today.`;
            try {
                const result = await sendWhatsAppMessage(guardianPhone, message, studentName);
                results.push({ 
                    studentName, 
                    guardianPhone, 
                    status: result.status || 'sent',
                    messageId: result.id
                });
                successCount++;
            } catch (error) {
                results.push({ 
                    studentName, 
                    guardianPhone, 
                    status: 'failed',
                    error: error.message
                });
                failureCount++;
            }
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
