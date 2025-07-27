import asyncHandler from 'express-async-handler';
import Timetable from '../models/timetableModel.js';
import User from '../models/userModel.js';
import TeacherAttendance from '../models/teacherAttendanceModel.js';
import mongoose from 'mongoose';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

// Function to get absent teachers for the current day
const getAbsentTeachers = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const absentTeachers = await TeacherAttendance.find({
        date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        },
        status: 'absent'
    });
    
    return absentTeachers.map(teacher => teacher.teacherName);
};

// @desc    Get timetable for a specific class and section
// @route   GET /api/timetable/:class/:section
// @access  Private
export const getTimetable = asyncHandler(async (req, res) => {
    // Static timetable data
    const staticTimetable = {
        periodTimes: [
            '8:00 – 8:45 AM',
            '8:45 – 9:30 AM',
            '9:45 – 10:30 AM',
            '10:30 – 11:15 AM',
            '11:30 – 12:15 PM',
            '12:15 – 1:00 PM',
            '1:30 – 2:15 PM',
            '2:15 – 3:00 PM'
        ],
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        classes: [
            { period: 1, time: '8:00 – 8:45 AM', monday: 'Computer Science', tuesday: 'Mathematics', wednesday: 'Science', thursday: 'English', friday: 'History', saturday: 'Computer Science', teacher: 'Teacher User' },
            { period: 2, time: '8:45 – 9:30 AM', monday: 'English', tuesday: 'Science', wednesday: 'Mathematics', thursday: 'Computer Science', friday: 'English', saturday: 'Mathematics', teacher: 'Teacher User' },
            { period: 3, time: '9:45 – 10:30 AM', monday: 'History', tuesday: 'Computer Science', wednesday: 'English', thursday: 'History', friday: 'Computer Science', saturday: 'English', teacher: 'Teacher User' },
            { period: 4, time: '10:30 – 11:15 AM', monday: 'Mathematics', tuesday: 'English', wednesday: 'Science', thursday: 'Science', friday: 'Mathematics', saturday: 'History', teacher: 'Teacher User' },
            { period: 5, time: '11:30 – 12:15 PM', monday: 'Science', tuesday: 'History', wednesday: 'Computer Science', thursday: 'Mathematics', friday: 'Science', saturday: 'Science', teacher: 'Teacher User' },
            { period: 6, time: '12:15 – 1:00 PM', monday: 'Physical Education', tuesday: 'Art', wednesday: 'Physical Education', thursday: 'Art', friday: 'Library', saturday: 'Club Activity', teacher: 'Teacher User' },
            { period: 7, time: '1:30 – 2:15 PM', monday: 'Language', tuesday: 'Language', wednesday: 'Language', thursday: 'Language', friday: 'Language', saturday: 'Language', teacher: 'Teacher User' },
            { period: 8, time: '2:15 – 3:00 PM', monday: 'Library', tuesday: 'Physical Education', wednesday: 'Art', thursday: 'Club Activity', friday: 'Art', saturday: 'Physical Education', teacher: 'Teacher User' }
        ]
    };

    // For admin users, check for absent teachers
    const isAdmin = req.user && req.user.role === 'admin';
    let absentTeachers = [];
    
    if (isAdmin) {
        absentTeachers = await getAbsentTeachers();
        
        // Add attendance status to each class
        staticTimetable.classes = staticTimetable.classes.map(classInfo => {
            const isTeacherAbsent = absentTeachers.includes(classInfo.teacher);
            return {
                ...classInfo,
                teacherAbsent: isTeacherAbsent
            };
        });
    }

    console.log(`Returning static timetable for class ${req.params.class}-${req.params.section}`);
    
    res.status(200).json({
        message: "Timetable retrieved successfully",
        timetable: staticTimetable,
        absentTeachers: isAdmin ? absentTeachers : []
    });
});

// @desc    Get timetable for student
// @route   GET /api/timetable/student
// @access  Private (Student)
export const getStudentTimetable = asyncHandler(async (req, res) => {
    // Static timetable data
    const staticTimetable = {
        periodTimes: [
            '8:00 – 8:45 AM',
            '8:45 – 9:30 AM',
            '9:45 – 10:30 AM',
            '10:30 – 11:15 AM',
            '11:30 – 12:15 PM',
            '12:15 – 1:00 PM',
            '1:30 – 2:15 PM',
            '2:15 – 3:00 PM'
        ],
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        classes: [
            { period: 1, time: '8:00 – 8:45 AM', monday: 'Computer Science', tuesday: 'Mathematics', wednesday: 'Science', thursday: 'English', friday: 'History', saturday: 'Computer Science', teacher: 'Teacher User' },
            { period: 2, time: '8:45 – 9:30 AM', monday: 'English', tuesday: 'Science', wednesday: 'Mathematics', thursday: 'Computer Science', friday: 'English', saturday: 'Mathematics', teacher: 'Teacher User' },
            { period: 3, time: '9:45 – 10:30 AM', monday: 'History', tuesday: 'Computer Science', wednesday: 'English', thursday: 'History', friday: 'Computer Science', saturday: 'English', teacher: 'Teacher User' },
            { period: 4, time: '10:30 – 11:15 AM', monday: 'Mathematics', tuesday: 'English', wednesday: 'Science', thursday: 'Science', friday: 'Mathematics', saturday: 'History', teacher: 'Teacher User' },
            { period: 5, time: '11:30 – 12:15 PM', monday: 'Science', tuesday: 'History', wednesday: 'Computer Science', thursday: 'Mathematics', friday: 'Science', saturday: 'Science', teacher: 'Teacher User' },
            { period: 6, time: '12:15 – 1:00 PM', monday: 'Physical Education', tuesday: 'Art', wednesday: 'Physical Education', thursday: 'Art', friday: 'Library', saturday: 'Club Activity', teacher: 'Teacher User' },
            { period: 7, time: '1:30 – 2:15 PM', monday: 'Language', tuesday: 'Language', wednesday: 'Language', thursday: 'Language', friday: 'Language', saturday: 'Language', teacher: 'Teacher User' },
            { period: 8, time: '2:15 – 3:00 PM', monday: 'Library', tuesday: 'Physical Education', wednesday: 'Art', thursday: 'Club Activity', friday: 'Art', saturday: 'Physical Education', teacher: 'Teacher User' }
        ]
    };
    
    console.log(`Returning static timetable for student ${req.user?._id || 'unknown'}`);
    
    // Get student class and section from user info
    const studentClass = req.user?.studentInfo?.class || '10';
    const studentSection = req.user?.studentInfo?.section || 'A';
    
    // Get all absent teachers for today
    const absentTeachers = await getAbsentTeachers();
    
    res.status(200).json({
        message: "Student timetable retrieved successfully",
        studentClass,
        studentSection,
        timetable: processTimetable(staticTimetable),
        absentTeachers
    });
});

// @desc    Get teacher's timetable
// @route   GET /api/timetable/teacher
// @access  Private (Teacher)
export const getTeacherTimetable = asyncHandler(async (req, res) => {
    // Static timetable data
    const staticTimetable = {
        periodTimes: [
            '8:00 – 8:45 AM',
            '8:45 – 9:30 AM',
            '9:45 – 10:30 AM',
            '10:30 – 11:15 AM',
            '11:30 – 12:15 PM',
            '12:15 – 1:00 PM',
            '1:30 – 2:15 PM',
            '2:15 – 3:00 PM'
        ],
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        classes: [
            { period: 1, time: '8:00 – 8:45 AM', monday: 'Computer Science', tuesday: 'Mathematics', wednesday: 'Science', thursday: 'English', friday: 'History', saturday: 'Computer Science', teacher: 'Teacher User' },
            { period: 2, time: '8:45 – 9:30 AM', monday: 'English', tuesday: 'Science', wednesday: 'Mathematics', thursday: 'Computer Science', friday: 'English', saturday: 'Mathematics', teacher: 'Teacher User' },
            { period: 3, time: '9:45 – 10:30 AM', monday: 'History', tuesday: 'Computer Science', wednesday: 'English', thursday: 'History', friday: 'Computer Science', saturday: 'English', teacher: 'Teacher User' },
            { period: 4, time: '10:30 – 11:15 AM', monday: 'Mathematics', tuesday: 'English', wednesday: 'Science', thursday: 'Science', friday: 'Mathematics', saturday: 'History', teacher: 'Teacher User' },
            { period: 5, time: '11:30 – 12:15 PM', monday: 'Science', tuesday: 'History', wednesday: 'Computer Science', thursday: 'Mathematics', friday: 'Science', saturday: 'Science', teacher: 'Teacher User' },
            { period: 6, time: '12:15 – 1:00 PM', monday: 'Physical Education', tuesday: 'Art', wednesday: 'Physical Education', thursday: 'Art', friday: 'Library', saturday: 'Club Activity', teacher: 'Teacher User' },
            { period: 7, time: '1:30 – 2:15 PM', monday: 'Language', tuesday: 'Language', wednesday: 'Language', thursday: 'Language', friday: 'Language', saturday: 'Language', teacher: 'Teacher User' },
            { period: 8, time: '2:15 – 3:00 PM', monday: 'Library', tuesday: 'Physical Education', wednesday: 'Art', thursday: 'Club Activity', friday: 'Art', saturday: 'Physical Education', teacher: 'Teacher User' }
        ]
    };

    console.log(`Returning static timetable for teacher`);
    
    const teacherName = req.user ? req.user.name : 'Teacher User';
    
    // Check if this teacher has marked attendance today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const attendance = await TeacherAttendance.findOne({
        teacherName,
        date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
    });
    
    // Get all absent teachers for today
    const absentTeachers = await getAbsentTeachers();
    
    res.status(200).json({
        message: "Teacher timetable retrieved successfully",
        teacherName: teacherName,
        timetable: processTimetable(staticTimetable),
        attendanceStatus: attendance ? attendance.status : 'not_marked',
        absentTeachers
    });
});

// @desc    Get all teachers from timetable
// @route   GET /api/timetable/teachers
// @access  Private (Admin)
export const getTeachersTimetable = asyncHandler(async (req, res) => {
    try {
        // Find all unique teacher names
        const teachers = await Timetable.distinct('teacher', { isActive: true });
        
        res.status(200).json({
            message: "Teachers retrieved successfully",
            teachers
        });
    } catch (error) {
        console.error(`Error fetching teachers from timetable:`, error);
        res.status(500).json({
            message: "Failed to retrieve teachers",
            error: error.message
        });
    }
});

// @desc    Get all classes and sections from timetable
// @route   GET /api/timetable/classes
// @access  Private (Admin)
export const getClassesAndSections = asyncHandler(async (req, res) => {
    try {
        // Find all unique class-section combinations
        const classData = await Timetable.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: {
                        class: "$class",
                        section: "$section"
                    }
                }
            },
            { $sort: { "_id.class": 1, "_id.section": 1 } }
        ]);
        
        // Transform data for easier consumption
        const classesAndSections = classData.reduce((acc, item) => {
            const className = item._id.class;
            const section = item._id.section;
            
            if (!acc[className]) {
                acc[className] = [];
            }
            
            if (!acc[className].includes(section)) {
                acc[className].push(section);
            }
            
            return acc;
        }, {});
        
        res.status(200).json({
            message: "Classes and sections retrieved successfully",
            classesAndSections
        });
    } catch (error) {
        console.error(`Error fetching classes and sections:`, error);
        res.status(500).json({
            message: "Failed to retrieve classes and sections",
            error: error.message
        });
    }
});

// @desc    Create new timetable entry
// @route   POST /api/timetable
// @access  Private (Admin)
export const createTimetableEntry = asyncHandler(async (req, res) => {
    try {
        const {
            class: className,
            section,
            dayOfWeek,
            period,
            subject,
            teacher,
            room,
            academicYear = new Date().getFullYear().toString()
        } = req.body;

        // Check for required fields
        if (!className || !section || dayOfWeek === undefined || !period || !subject || !teacher) {
            return res.status(400).json({
                message: "Please provide all required fields"
            });
        }

        // Check if entry already exists
        const existingEntry = await Timetable.findOne({
            class: className,
            section,
            dayOfWeek,
            period,
            academicYear
        });

        if (existingEntry) {
            return res.status(400).json({
                message: "A timetable entry already exists for this slot",
                existingEntry
            });
        }

        // Create new entry
        const timetableEntry = await Timetable.create({
            class: className,
            section,
            dayOfWeek,
            period,
            subject,
            teacher,
            room,
            academicYear,
            isActive: true
        });

        console.log(`Created new timetable entry: Class ${className}-${section}, Day ${dayOfWeek}, Period ${period}`);
        res.status(201).json({
            message: "Timetable entry created successfully",
            timetableEntry
        });
    } catch (error) {
        console.error(`Error creating timetable entry:`, error);
        res.status(500).json({
            message: "Failed to create timetable entry",
            error: error.message
        });
    }
});

// @desc    Update timetable entry
// @route   PUT /api/timetable/:id
// @access  Private (Admin)
export const updateTimetableEntry = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const {
            subject,
            teacher,
            room,
            isActive
        } = req.body;

        // Find the timetable entry
        const timetableEntry = await Timetable.findById(id);
        if (!timetableEntry) {
            return res.status(404).json({
                message: "Timetable entry not found"
            });
        }

        // Update fields
        if (subject) timetableEntry.subject = subject;
        if (teacher) timetableEntry.teacher = teacher;
        if (room !== undefined) timetableEntry.room = room;
        if (isActive !== undefined) timetableEntry.isActive = isActive;

        // Save changes
        await timetableEntry.save();

        res.status(200).json({
            message: "Timetable entry updated successfully",
            timetableEntry
        });
    } catch (error) {
        console.error(`Error updating timetable entry:`, error);
        res.status(500).json({
            message: "Failed to update timetable entry",
            error: error.message
        });
    }
});

// @desc    Delete timetable entry
// @route   DELETE /api/timetable/:id
// @access  Private (Admin)
export const deleteTimetableEntry = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        
        const timetableEntry = await Timetable.findById(id);
        
        if (!timetableEntry) {
            return res.status(404).json({
                message: "Timetable entry not found"
            });
        }
        
        await timetableEntry.deleteOne();
        
        res.status(200).json({
            message: "Timetable entry deleted successfully",
            entry: timetableEntry
        });
    } catch (error) {
        console.error(`Error deleting timetable entry:`, error);
        res.status(500).json({
            message: "Failed to delete timetable entry",
            error: error.message
        });
    }
});

// @desc    Admin: Create or update multiple timetable entries
// @route   POST /api/timetable/bulk
// @access  Private (Admin)
export const bulkUpdateTimetable = asyncHandler(async (req, res) => {
    try {
        const { entries } = req.body;
        
        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({
                message: "Please provide timetable entries"
            });
        }
        
        console.log(`Processing ${entries.length} timetable entries in bulk`);
        
        const results = await Promise.all(entries.map(async entry => {
            const {
                _id,
                class: className,
                section,
                dayOfWeek,
                period,
                subject,
                teacher,
                room,
                academicYear = new Date().getFullYear().toString(),
                isActive = true
            } = entry;
            
            // Check for required fields
            if (!className || !section || dayOfWeek === undefined || !period || !subject || !teacher) {
                return {
                    status: 'error',
                    message: "Missing required fields",
                    entry
                };
            }
            
            try {
                // Find if entry exists
                const filter = _id 
                    ? { _id }
                    : {
                        class: className,
                        section,
                        dayOfWeek,
                        period,
                        academicYear
                    };
                
                const update = {
                    class: className,
                    section,
                    dayOfWeek,
                    period,
                    subject,
                    teacher,
                    room,
                    academicYear,
                    isActive
                };
                
                // Use findOneAndUpdate with upsert to create or update
                const updatedEntry = await Timetable.findOneAndUpdate(
                    filter,
                    update,
                    { 
                        new: true, 
                        upsert: true,
                        setDefaultsOnInsert: true
                    }
                );
                
                return {
                    status: 'success',
                    message: "Entry updated/created successfully",
                    entry: updatedEntry
                };
            } catch (error) {
                console.error(`Error processing entry ${_id || `${className}-${section}-${dayOfWeek}-${period}`}:`, error);
                return {
                    status: 'error',
                    message: error.message,
                    entry
                };
            }
        }));
        
        // Count success and errors
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        
        res.status(200).json({
            message: `Processed ${entries.length} timetable entries: ${successCount} successful, ${errorCount} failed`,
            successCount,
            errorCount,
            results
        });
    } catch (error) {
        console.error(`Error processing bulk timetable entries:`, error);
        res.status(500).json({
            message: "Failed to process timetable entries",
            error: error.message
        });
    }
});

// @desc    Seed timetable with sample data
// @route   GET /api/timetable/seed
// @access  Private (Admin)
export const seedTimetable = asyncHandler(async (req, res) => {
    try {
        // Define sample data
        const teacherNames = [
            'Mr. John Smith', 
            'Ms. Sarah Johnson', 
            'Mr. Robert Williams', 
            'Mrs. Emily Davis', 
            'Dr. Michael Brown'
        ];
        
        const subjects = [
            'Mathematics', 
            'English', 
            'Science', 
            'History', 
            'Geography', 
            'Physics', 
            'Chemistry', 
            'Biology', 
            'Computer Science'
        ];
        
        const rooms = ['101', '102', '103', '104', '105', '201', '202', '203', '204'];
        
        const classes = ['9', '10', '11', '12'];
        const sections = ['A', 'B'];
        
        const bulkOperations = [];
        const academicYear = new Date().getFullYear().toString();
        
        // Generate sample timetable for each class and section
        for (const className of classes) {
            for (const section of sections) {
                // Create entries for Monday to Friday (1-5)
                for (let day = 1; day <= 5; day++) {
                    // Create 6 periods per day
                    for (let period = 1; period <= 6; period++) {
                        const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];
                        const randomTeacher = teacherNames[Math.floor(Math.random() * teacherNames.length)];
                        const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
                        
                        bulkOperations.push({
                            updateOne: {
                                filter: {
                                    class: className,
                                    section,
                                    dayOfWeek: day,
                                    period,
                                    academicYear
                                },
                                update: {
                                    $set: {
                                        subject: randomSubject,
                                        teacher: randomTeacher,
                                        room: randomRoom,
                                        isActive: true
                                    }
                                },
                                upsert: true
                            }
                        });
                    }
                }
            }
        }
        
        // Use bulkWrite for better performance and error handling
        const result = await Timetable.bulkWrite(bulkOperations);
        
        res.status(201).json({
            message: `Timetable data seeded successfully`,
            operations: `${result.upsertedCount} created, ${result.modifiedCount} updated`,
            result
        });
    } catch (error) {
        console.error('Error seeding timetable data:', error);
        res.status(500).json({
            message: "Failed to seed timetable data",
            error: error.message
        });
    }
});

// @desc    Upload timetable from Excel file
// @route   POST /api/timetable/upload
// @access  Private (Admin only)
export const uploadTimetable = asyncHandler(async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an Excel file' });
        }

        const filePath = req.file.path;
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        
        // Check if it's an Excel file
        if (!['.xlsx', '.xls'].includes(fileExt)) {
            // Delete the uploaded file
            fs.unlinkSync(filePath);
            return res.status(400).json({ message: 'Please upload an Excel file' });
        }
        
        // Parse the Excel file
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);
        
        // Delete the uploaded file after reading
        fs.unlinkSync(filePath);
        
        if (data.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }
        
        // Validate and process the data
        const bulkOperations = [];
        const academicYear = req.body.academicYear || new Date().getFullYear().toString();
        
        for (const row of data) {
            // Check if required fields are present
            if (!row.class || !row.section || row.dayOfWeek === undefined || 
                row.period === undefined || !row.subject || !row.teacher) {
                continue;
            }
            
            // Convert dayOfWeek to number (1-5 for Monday-Friday)
            const dayOfWeek = typeof row.dayOfWeek === 'number' ? row.dayOfWeek : 
                              ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                              .indexOf(row.dayOfWeek.toLowerCase()) + 1;
            
            if (dayOfWeek < 1 || dayOfWeek > 7) {
                continue;
            }
            
            // Convert period to number
            const period = typeof row.period === 'number' ? row.period : parseInt(row.period);
            
            if (isNaN(period) || period < 1 || period > 8) {
                continue;
            }
            
            bulkOperations.push({
                updateOne: {
                    filter: {
                        class: row.class,
                        section: row.section,
                        dayOfWeek,
                        period,
                        academicYear
                    },
                    update: {
                        $set: {
                            subject: row.subject,
                            teacher: row.teacher,
                            room: row.room || '',
                            isActive: true
                        }
                    },
                    upsert: true
                }
            });
        }
        
        if (bulkOperations.length === 0) {
            return res.status(400).json({ message: 'No valid timetable entries found in the Excel file' });
        }
        
        // Perform the bulk operation
        const result = await Timetable.bulkWrite(bulkOperations);
        
        res.status(200).json({
            message: 'Timetable uploaded successfully',
            result: {
                created: result.upsertedCount,
                updated: result.modifiedCount
            }
        });
        
    } catch (error) {
        console.error('Error uploading timetable:', error);
        res.status(500).json({
            message: 'Failed to upload timetable',
            error: error.message
        });
    }
});

// @desc    Download timetable sample Excel template
// @route   GET /api/timetable/template
// @access  Private (Admin only)
export const downloadTemplate = asyncHandler(async (req, res) => {
    try {
        // Create a sample workbook
        const workbook = xlsx.utils.book_new();
        
        // Sample data
        const sampleData = [
            { class: 'IX', section: 'A', dayOfWeek: 1, period: 1, subject: 'Mathematics', teacher: 'Mr. Smith', room: 'Room 101' },
            { class: 'IX', section: 'A', dayOfWeek: 1, period: 2, subject: 'English', teacher: 'Ms. Johnson', room: 'Room 102' },
            { class: 'IX', section: 'A', dayOfWeek: 2, period: 1, subject: 'Science', teacher: 'Dr. Brown', room: 'Lab 1' }
        ];
        
        // Convert to worksheet
        const worksheet = xlsx.utils.json_to_sheet(sampleData);
        
        // Add worksheet to workbook
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Timetable Template');
        
        // Create temp file
        const tempFilePath = path.join(process.cwd(), 'temp-timetable-template.xlsx');
        xlsx.writeFile(workbook, tempFilePath);
        
        // Send the file
        res.download(tempFilePath, 'timetable-template.xlsx', (err) => {
            // Delete the temp file after sending
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            
            if (err) {
                console.error('Error sending template:', err);
                // If headers already sent, we can't send another response
                if (!res.headersSent) {
                    res.status(500).json({
                        message: 'Error downloading template',
                        error: err.message
                    });
                }
            }
        });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({
            message: 'Failed to create template',
            error: error.message
        });
    }
});

// @desc    Get admin's view of timetable with absent teachers
// @route   GET /api/timetable/admin
// @access  Private (Admin)
export const getAdminTimetable = asyncHandler(async (req, res) => {
    // Static timetable data
    const staticTimetable = {
        periodTimes: [
            '8:00 – 8:45 AM',
            '8:45 – 9:30 AM',
            '9:45 – 10:30 AM',
            '10:30 – 11:15 AM',
            '11:30 – 12:15 PM',
            '12:15 – 1:00 PM',
            '1:30 – 2:15 PM',
            '2:15 – 3:00 PM'
        ],
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        classes: [
            { period: 1, time: '8:00 – 8:45 AM', monday: 'Computer Science', tuesday: 'Mathematics', wednesday: 'Science', thursday: 'English', friday: 'History', saturday: 'Computer Science', teacher: 'Teacher User' },
            { period: 2, time: '8:45 – 9:30 AM', monday: 'English', tuesday: 'Science', wednesday: 'Mathematics', thursday: 'Computer Science', friday: 'English', saturday: 'Mathematics', teacher: 'Teacher User' },
            { period: 3, time: '9:45 – 10:30 AM', monday: 'History', tuesday: 'Computer Science', wednesday: 'English', thursday: 'History', friday: 'Computer Science', saturday: 'English', teacher: 'Teacher User' },
            { period: 4, time: '10:30 – 11:15 AM', monday: 'Mathematics', tuesday: 'English', wednesday: 'Science', thursday: 'Science', friday: 'Mathematics', saturday: 'History', teacher: 'Teacher User' },
            { period: 5, time: '11:30 – 12:15 PM', monday: 'Science', tuesday: 'History', wednesday: 'Computer Science', thursday: 'Mathematics', friday: 'Science', saturday: 'Science', teacher: 'Teacher User' },
            { period: 6, time: '12:15 – 1:00 PM', monday: 'Physical Education', tuesday: 'Art', wednesday: 'Physical Education', thursday: 'Art', friday: 'Library', saturday: 'Club Activity', teacher: 'Teacher User' },
            { period: 7, time: '1:30 – 2:15 PM', monday: 'Language', tuesday: 'Language', wednesday: 'Language', thursday: 'Language', friday: 'Language', saturday: 'Language', teacher: 'Teacher User' },
            { period: 8, time: '2:15 – 3:00 PM', monday: 'Library', tuesday: 'Physical Education', wednesday: 'Art', thursday: 'Club Activity', friday: 'Art', saturday: 'Physical Education', teacher: 'Teacher User' }
        ]
    };

    // Get absent teachers for today
    const absentTeachers = await getAbsentTeachers();
    
    // Add attendance status to each class
    staticTimetable.classes = staticTimetable.classes.map(classInfo => {
        const isTeacherAbsent = absentTeachers.includes(classInfo.teacher);
        return {
            ...classInfo,
            teacherAbsent: isTeacherAbsent
        };
    });

    // Get all teachers attendance status
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const teachers = await User.find({ role: 'teacher' })
        .select('name email');
    
    const attendanceRecords = await TeacherAttendance.find({
        date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
    });
    
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
        attendanceMap[record.teacherName] = {
            status: record.status,
            reason: record.reason
        };
    });
    
    const teachersWithAttendance = teachers.map(teacher => ({
        _id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        attendance: attendanceMap[teacher.name] || { status: 'not_marked', reason: '' }
    }));
    
    res.status(200).json({
        message: "Admin timetable view retrieved successfully",
        timetable: staticTimetable,
        absentTeachers,
        teachersAttendance: teachersWithAttendance
    });
}); 