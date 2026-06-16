import { Homework, Submission } from '../models/homeworkModel.js';
import Student from '../models/studentModel.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createSafeUploadFilename, isAllowedUploadExtension, hasValidMagicBytes } from '../utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer with memory storage for magic-byte validation
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.stl', '.obj', '.fbx', '.zip', '.rar', '.png', '.jpg', '.jpeg']);
        if (!allowedExtensions.has(path.extname(file.originalname).toLowerCase())) {
            return cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, STL, OBJ, FBX, ZIP, RAR, PNG, JPG, and JPEG files are allowed.'));
        }
        cb(null, true);
    }
});

// Helper: write uploaded buffer to disk with safe filename
function writeHomeworkFile(buffer, originalname, subdir) {
    const uploadDir = path.join(__dirname, '../public/uploads', subdir);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const safeFilename = createSafeUploadFilename(originalname);
    fs.writeFileSync(path.join(uploadDir, safeFilename), buffer);
    return `/uploads/${subdir}/${safeFilename}`;
}

const submissionUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.txt', '.stl', '.obj', '.fbx', '.zip', '.png', '.jpg', '.jpeg']);
        if (!allowedExtensions.has(path.extname(file.originalname).toLowerCase())) {
            return cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, STL, OBJ, FBX, ZIP, PNG, JPG, and JPEG files are allowed.'));
        }
        cb(null, true);
    }
});

export async function addHomework(req, res) {
    try {
        const { class: className, section, subject, title, description, dueDate } = req.body;
        const homeworkData = {
            class: className,
            section,
            subject,
            title,
            description,
            dueDate,
            assignedBy: req.user.id
        };
        
        const homework = await Homework.create(homeworkData);
        res.status(201).json(homework);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
}

export async function getHomework(req, res) {
    try {
        const { studentId } = req.params;
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const homework = await Homework.getHomeworkByClass({
            class: student.class,
            section: student.section
        });
        res.json(homework);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
}

// Create new homework
export async function createHomework(req, res) {
    try {
        const uploadDir = path.join(__dirname, '../public/uploads/homework');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        upload(req, res, async function (err) {
            if (err) {
                console.error('Upload error:', err);
                return res.status(400).json({ message: err.message });
            }

            try {
                const { title, description, classId, section, expiryDate, allowSubmission } = req.body;
                
                if (!title || !description || !classId || !section || !expiryDate) {
                    return res.status(400).json({ 
                        message: 'Missing required fields',
                        receivedData: { title, description, classId, section, expiryDate }
                    });
                }
                
                // Validate magic bytes for uploaded file
                if (req.file && !hasValidMagicBytes(req.file)) {
                    return res.status(400).json({ message: 'Uploaded file appears to be corrupted or has invalid content' });
                }
                
                const allowStudentSubmission = 
                    allowSubmission === 'on' || 
                    allowSubmission === 'true' || 
                    allowSubmission === true;
                
                console.log('Creating homework with data:', {
                    title, description, classId, section, expiryDate,
                    allowSubmission: allowStudentSubmission,
                    teacherId: req.user._id
                });
                
                const fileUrl = req.file ? writeHomeworkFile(req.file.buffer, req.file.originalname, 'homework') : null;
                
                const homework = new Homework({
                    title,
                    description,
                    class: classId,
                    section,
                    teacher: req.user._id,
                    expiryDate: new Date(expiryDate),
                    allowSubmission: allowStudentSubmission,
                    fileUrl,
                    fileType: req.file ? path.extname(req.file.originalname).substring(1) : null
                });

                await homework.save();
                res.status(201).json({ message: 'Homework created successfully', homework });
            } catch (error) {
                console.error('Error in homework creation:', error);
                res.status(500).json({ message: 'Error creating homework', error: error.message });
            }
        });
    } catch (error) {
        console.error('Outer error in createHomework:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

// Get homework for a class
export async function getClassHomework(req, res) {
    try {
        const { classId } = req.params;
        
        let classValue, sectionValue;
        
        if (classId.includes('-')) {
            [classValue, sectionValue] = classId.split('-');
        } else {
            classValue = classId;
            sectionValue = null;
        }
        
        // Enforce class membership
        if (req.user.role === 'student') {
            const studentClass = req.user.studentInfo?.class;
            const studentSection = req.user.studentInfo?.section;
            if (!studentClass || classValue !== studentClass || (sectionValue && sectionValue !== studentSection)) {
                return res.status(403).json({ message: 'You can only view homework for your own class and section' });
            }
        } else if (req.user.role === 'teacher') {
            // Teachers may only access classes they are assigned to
            const assignedClasses = [];
            if (req.user.teacherInfo?.classTeacher?.class) {
                assignedClasses.push(req.user.teacherInfo.classTeacher.class);
            }
            const hasAccess = assignedClasses.length === 0 || assignedClasses.includes(classValue);
            if (!hasAccess) {
                return res.status(403).json({ message: 'You are not assigned to this class' });
            }
        }
        
        const query = { class: classValue, isActive: true };
        if (sectionValue) {
            query.section = sectionValue;
        }
        
        const homework = await Homework.find(query)
            .populate('teacher', 'name')
            .sort({ expiryDate: 1 });
        
        res.status(200).json(homework);
    } catch (error) {
        console.error('Error fetching homework:', error);
        res.status(500).json({ message: 'Error fetching homework', error: error.message });
    }
}

// Get homework by teacher
export async function getTeacherHomework(req, res) {
    try {
        const teacherId = req.user._id;
        const homework = await Homework.find({
            teacher: teacherId,
            isActive: true
        }).sort({ createdAt: -1 });

        res.status(200).json(homework);
    } catch (error) {
        console.error('Error fetching teacher homework:', error);
        res.status(500).json({ message: 'Error fetching homework', error: error.message });
    }
}

// Update homework
export async function updateHomework(req, res) {
    try {
        const { homeworkId } = req.params;
        const { title, description, expiryDate } = req.body;

        const homework = await Homework.findOne({
            _id: homeworkId,
            teacher: req.user._id
        });

        if (!homework) {
            return res.status(404).json({ message: 'Homework not found' });
        }

        if (title) homework.title = title;
        if (description) homework.description = description;
        if (expiryDate) homework.expiryDate = new Date(expiryDate);

        await homework.save();
        res.status(200).json({ message: 'Homework updated successfully', homework });
    } catch (error) {
        console.error('Error updating homework:', error);
        res.status(500).json({ message: 'Error updating homework', error: error.message });
    }
}

// Delete homework
export async function deleteHomework(req, res) {
    try {
        const { homeworkId } = req.params;

        const homework = await Homework.findOne({
            _id: homeworkId,
            teacher: req.user._id
        });

        if (!homework) {
            return res.status(404).json({ message: 'Homework not found' });
        }

        await Submission.deleteMany({ homework: homeworkId });
        await Homework.deleteOne({ _id: homeworkId });

        res.status(200).json({ message: 'Homework deleted successfully' });
    } catch (error) {
        console.error('Error deleting homework:', error);
        res.status(500).json({ message: 'Error deleting homework', error: error.message });
    }
}

// Submit homework (student)
export async function submitHomework(req, res) {
    try {
        const { homeworkId } = req.params;
        const studentId = req.user._id;
        
        const homework = await Homework.findById(homeworkId);
        if (!homework) {
            return res.status(404).json({ message: 'Homework not found' });
        }
        
        if (!homework.allowSubmission) {
            return res.status(400).json({ message: 'This homework does not allow submissions' });
        }
        
        const now = new Date();
        if (now > homework.expiryDate) {
            return res.status(400).json({ message: 'Homework submission deadline has passed' });
        }
        
        // Verify student belongs to this class/section
        if (req.user.role === 'student') {
            const studentClass = req.user.studentInfo?.class;
            const studentSection = req.user.studentInfo?.section;
            if (homework.class !== studentClass || homework.section !== studentSection) {
                return res.status(403).json({ message: 'This homework is not for your class/section' });
            }
        }
        
        submissionUpload(req, res, async function(err) {
            if (err) {
                console.error('Upload error:', err);
                return res.status(400).json({ message: err.message });
            }
            
            try {
                if (!req.file) {
                    return res.status(400).json({ message: 'No file uploaded' });
                }
                
                // Validate magic bytes
                if (!hasValidMagicBytes(req.file)) {
                    return res.status(400).json({ message: 'Uploaded file appears to be corrupted or has invalid content' });
                }
                
                const filePath = writeHomeworkFile(req.file.buffer, req.file.originalname, 'submissions');
                
                const existingSubmission = await Submission.findOne({
                    homework: homeworkId,
                    student: studentId
                });
                
                if (existingSubmission) {
                    existingSubmission.status = 'submitted';
                    existingSubmission.submissionDate = new Date();
                    existingSubmission.attachments.push({
                        filename: req.file.originalname,
                        path: filePath,
                        uploadedAt: new Date()
                    });
                    
                    if (req.body.notes) {
                        existingSubmission.notes = req.body.notes;
                    }
                    
                    await existingSubmission.save();
                    
                    return res.status(200).json({
                        message: 'Homework submission updated successfully',
                        submission: existingSubmission
                    });
                }
                
                const submission = new Submission({
                    homework: homeworkId,
                    student: studentId,
                    status: 'submitted',
                    submissionDate: new Date(),
                    notes: req.body.notes || '',
                    attachments: [{
                        filename: req.file.originalname,
                        path: filePath,
                        uploadedAt: new Date()
                    }]
                });
                
                await submission.save();
                
                res.status(201).json({
                    message: 'Homework submitted successfully',
                    submission
                });
                
            } catch (error) {
                console.error('Error processing submission:', error);
                res.status(500).json({ message: 'Error processing submission', error: error.message });
            }
        });
    } catch (error) {
        console.error('Error in homework submission:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

// Get homework submissions
export async function getHomeworkSubmissions(req, res) {
    try {
        const { homeworkId } = req.params;
        const teacherId = req.user._id;
        
        const homework = await Homework.findOne({
            _id: homeworkId,
            teacher: teacherId
        });
        
        if (!homework) {
            return res.status(404).json({ message: 'Homework not found or you do not have permission to view it' });
        }
        
        if (!homework.allowSubmission) {
            return res.status(400).json({ message: 'This homework does not allow submissions' });
        }
        
        const submissions = await Submission.find({ homework: homeworkId })
            .populate({
                path: 'student',
                select: 'name studentInfo'
            })
            .sort({ submissionDate: -1 });
        
        res.status(200).json(submissions);
    } catch (error) {
        console.error('Error fetching homework submissions:', error);
        res.status(500).json({ message: 'Error fetching submissions', error: error.message });
    }
}