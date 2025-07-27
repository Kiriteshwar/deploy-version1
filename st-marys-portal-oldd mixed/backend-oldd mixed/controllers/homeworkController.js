import { Homework, Submission } from '../models/homeworkModel.js';
import Student from '../models/studentModel.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/homework');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.stl', '.obj', '.fbx', '.zip', '.rar', '.png', '.jpg', '.jpeg'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, STL, OBJ, FBX, ZIP, RAR, PNG, JPG, and JPEG files are allowed.'));
        }
    }
}).single('homeworkFile');

// Configure multer for student submission uploads
const submissionStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/submissions');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Format: homeworkId_userId_timestamp_filename
        const homeworkId = req.params.homeworkId;
        const userId = req.user._id;
        cb(null, `${homeworkId}_${userId}_${Date.now()}_${file.originalname}`);
    }
});

const uploadSubmission = multer({
    storage: submissionStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.stl', '.obj', '.fbx', '.zip', '.png', '.jpg', '.jpeg'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, STL, OBJ, FBX, ZIP, PNG, JPG, and JPEG files are allowed.'));
        }
    }
}).single('submissionFile');

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
        // Ensure the upload directory exists
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
                
                // Process checkbox value - can be 'on', 'true', or true
                const allowStudentSubmission = 
                    allowSubmission === 'on' || 
                    allowSubmission === 'true' || 
                    allowSubmission === true;
                
                console.log('Creating homework with data:', {
                    title,
                    description,
                    classId,
                    section,
                    expiryDate,
                    allowSubmission: allowStudentSubmission,
                    teacherId: req.user._id
                });
                
                const homework = new Homework({
                    title,
                    description,
                    class: classId,
                    section,
                    teacher: req.user._id,
                    expiryDate: new Date(expiryDate),
                    allowSubmission: allowStudentSubmission,
                    fileUrl: req.file ? `/uploads/homework/${req.file.filename}` : null,
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
        console.log('Fetching homework for class:', classId);
        
        // Parse class and section from classId (format: "class-section")
        let classValue, sectionValue;
        
        if (classId.includes('-')) {
            [classValue, sectionValue] = classId.split('-');
        } else {
            classValue = classId;
            sectionValue = null; // Default to null if no section specified
        }
        
        console.log(`Parsed class: ${classValue}, section: ${sectionValue}`);
        
        // Create the base query object for the class
        const query = {
            class: classValue,
            isActive: true
        };
        
        // If a section is specified, add it to the query
        if (sectionValue) {
            query.section = sectionValue;
        }
        
        console.log('Query:', query);
        
        // Get all homework matching the exact class and section
        const homework = await Homework.find(query)
            .populate('teacher', 'name')
            .sort({ expiryDate: 1 });
        
        console.log(`Found ${homework.length} homework assignments for ${classValue}${sectionValue ? '-' + sectionValue : ''}`);
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
        console.log(`Fetching homework for teacher: ${teacherId}`);
        
        const homework = await Homework.find({
            teacher: teacherId,
            isActive: true
        }).sort({ createdAt: -1 });

        console.log(`Found ${homework.length} homework assignments for teacher`);
        
        // Log classes to help debug issues
        const classes = new Set(homework.map(hw => hw.class));
        console.log('Classes in homework:', Array.from(classes));

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

        // Find the homework to verify it belongs to the teacher
        const homework = await Homework.findOne({
            _id: homeworkId,
            teacher: req.user._id
        });

        if (!homework) {
            return res.status(404).json({ message: 'Homework not found' });
        }

        // Perform a hard delete instead of a soft delete
        // First delete any related submissions
        await Submission.deleteMany({ homework: homeworkId });
        
        // Then delete the homework itself
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
        
        // Check if homework exists and allows submissions
        const homework = await Homework.findById(homeworkId);
        if (!homework) {
            return res.status(404).json({ message: 'Homework not found' });
        }
        
        if (!homework.allowSubmission) {
            return res.status(400).json({ message: 'This homework does not allow submissions' });
        }
        
        // Check if homework is expired
        const now = new Date();
        if (now > homework.expiryDate) {
            return res.status(400).json({ message: 'Homework submission deadline has passed' });
        }
        
        // Process file upload
        uploadSubmission(req, res, async function(err) {
            if (err) {
                console.error('Upload error:', err);
                return res.status(400).json({ message: err.message });
            }
            
            try {
                if (!req.file) {
                    return res.status(400).json({ message: 'No file uploaded' });
                }
                
                // Check if student already submitted this homework
                const existingSubmission = await Submission.findOne({
                    homework: homeworkId,
                    student: studentId
                });
                
                if (existingSubmission) {
                    // Update existing submission
                    existingSubmission.status = 'submitted';
                    existingSubmission.submissionDate = new Date();
                    existingSubmission.attachments.push({
                        filename: req.file.originalname,
                        path: `/uploads/submissions/${req.file.filename}`,
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
                
                // Create new submission
                const submission = new Submission({
                    homework: homeworkId,
                    student: studentId,
                    status: 'submitted',
                    submissionDate: new Date(),
                    notes: req.body.notes || '',
                    attachments: [{
                        filename: req.file.originalname,
                        path: `/uploads/submissions/${req.file.filename}`,
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
        
        // First check if the homework exists and belongs to the teacher
        const homework = await Homework.findOne({
            _id: homeworkId,
            teacher: teacherId
        });
        
        if (!homework) {
            return res.status(404).json({ message: 'Homework not found or you do not have permission to view it' });
        }
        
        // Check if the homework allows submissions
        if (!homework.allowSubmission) {
            return res.status(400).json({ message: 'This homework does not allow submissions' });
        }
        
        // Get all submissions for this homework
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

// exports.addHomework = async (req, res) => {
//   try {
//     const { student_id, subject, title, description, due_date, status } = req.body;
//     const homework = await homeworkModel.addHomework(student_id, subject, title, description, due_date, status);
//     res.json(homework);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Server Error' });
//   }
// };

// exports.getHomework = async (req, res) => {
//   try {
//     const student_id = req.params.studentId;
//     const records = await homeworkModel.getHomeworkByStudent(student_id);
//     res.json(records);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Server Error' });
//   }
// };

