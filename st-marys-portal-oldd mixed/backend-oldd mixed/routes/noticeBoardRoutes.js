import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { protect, teacherOnly } from '../middleware/authMiddleware.js';
import { createSafeUploadFilename, isAllowedUploadExtension, hasValidMagicBytes } from '../utils/security.js';
import Notice from '../models/noticeboardModel.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store files in memory for magic-byte validation before writing to disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
    fileFilter: function (req, file, cb) {
        if (!isAllowedUploadExtension(file.originalname)) {
            return cb(new Error('Only PDF, Word documents, and image files are allowed!'));
        }
        cb(null, true);
    }
});

function writeUploadToDisk(buffer, originalname) {
    const uploadDir = 'public/uploads/notices';
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const safeFilename = createSafeUploadFilename(originalname);
    fs.writeFileSync(path.join(uploadDir, safeFilename), buffer);
    return `uploads/notices/${safeFilename}`;
}

// Get all notices
router.get('/', protect, async (req, res) => {
    try {
        // Get all notices with their targeting info
        const notices = await Notice.find().sort({ date: -1 });
        
        // Filter notices based on user role
        if (req.user.role === 'teacher') {
            // Get the teacher's assigned sections for notice visibility
            const teacherNoticeSections = req.user.teacherInfo?.noticeSections || [];
            
            // Add the teacher's own section if they are a class teacher
            const classTeacherClass = req.user.teacherInfo?.classTeacher?.class;
            const classTeacherSection = req.user.teacherInfo?.classTeacher?.section;
            
            if (classTeacherClass && classTeacherSection) {
                const classTeacherCombo = `${classTeacherClass}-${classTeacherSection}`;
                if (!teacherNoticeSections.includes(classTeacherCombo)) {
                    teacherNoticeSections.push(classTeacherCombo);
                }
            }
            
            // If no sections assigned, only show general notices or notices created by this teacher
            const filteredNotices = notices.filter(notice => {
                if (notice.author.includes(req.user.name)) return true;
                if (teacherNoticeSections.length === 0) {
                    return notice.targetClass === 'all' && notice.targetSection === 'all';
                }
                if (notice.targetClass === 'all' && notice.targetSection === 'all') return true;
                return teacherNoticeSections.some(combo => {
                    // Split the combo into class and section
                    const [teacherClass, teacherSection] = combo.split('-');
                    
                    // Notice is visible if it targets the teacher's class and either all sections or the specific section
                    return (notice.targetClass === teacherClass || notice.targetClass === 'all') &&
                           (notice.targetSection === teacherSection || notice.targetSection === 'all');
                });
            });
            return res.json(filteredNotices);
        }

        // Server-side filtering for students
        if (req.user.role === 'student') {
            const studentClass = req.user.studentInfo?.class;
            const studentSection = req.user.studentInfo?.section;
            if (studentClass && studentSection) {
                const filteredNotices = notices.filter(notice => {
                    if (notice.targetClass === 'all' && notice.targetSection === 'all') return true;
                    if (notice.targetClass === studentClass || notice.targetClass === 'all') {
                        return notice.targetSection === 'all' || notice.targetSection === studentSection;
                    }
                    return false;
                });
                return res.json(filteredNotices);
            }
        }
        res.json(notices);
    } catch (error) {
        console.error('Error fetching notices:', error);
        res.status(500).json({ message: 'Error fetching notices', error: error.message });
    }
});

// Get a specific notice
router.get('/:id', protect, async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);
        if (!notice) {
            return res.status(404).json({ message: 'Notice not found' });
        }
        res.json(notice);
    } catch (error) {
        console.error('Error fetching notice:', error);
        res.status(500).json({ message: 'Error fetching notice', error: error.message });
    }
});

// Create a new notice
router.post('/', protect, teacherOnly, upload.single('attachment'), async (req, res) => {
    try {
        const { 
            title, 
            content, 
            category, 
            date, 
            author, 
            important, 
            targetClass, 
            targetSection,
            visibleToTeachers,
            teacherSections
        } = req.body;

        // Validate magic bytes for uploaded file
        if (req.file && !hasValidMagicBytes(req.file)) {
            return res.status(400).json({ message: 'Uploaded file appears to be corrupted or has invalid content' });
        }

        let attachmentPath = null;
        if (req.file) {
            attachmentPath = writeUploadToDisk(req.file.buffer, req.file.originalname);
        }
        
        const notice = new Notice({
            title,
            content,
            category,
            date: date || Date.now(),
            author: author || req.user.name || 'Admin',
            important: important === 'true',
            attachment: attachmentPath,
            targetClass: targetClass || 'all',
            targetSection: targetSection || 'all',
            visibleToTeachers: visibleToTeachers === 'true',
            teacherSections: teacherSections ? 
                (Array.isArray(teacherSections) ? teacherSections : [teacherSections]) : 
                ['all']
        });

        await notice.save();
        res.status(201).json(notice);
    } catch (error) {
        console.error('Error creating notice:', error);
        res.status(500).json({ message: 'Error creating notice', error: error.message });
    }
});

// Update a notice
router.put('/:id', protect, teacherOnly, upload.single('attachment'), async (req, res) => {
    try {
        const { 
            title, 
            content, 
            category, 
            date, 
            author, 
            important, 
            targetClass, 
            targetSection,
            visibleToTeachers,
            teacherSections
        } = req.body;
        
        const notice = await Notice.findById(req.params.id);
        if (!notice) {
            return res.status(404).json({ message: 'Notice not found' });
        }

        if (req.file && !hasValidMagicBytes(req.file)) {
            return res.status(400).json({ message: 'Uploaded file appears to be corrupted or has invalid content' });
        }

        notice.title = title || notice.title;
        notice.content = content || notice.content;
        notice.category = category || notice.category;
        notice.date = date || notice.date;
        notice.author = author || notice.author;
        notice.important = important === 'true';
        notice.targetClass = targetClass || notice.targetClass || 'all';
        notice.targetSection = targetSection || notice.targetSection || 'all';
        
        // Update teacher visibility settings
        if (req.user.role === 'admin') {
            notice.visibleToTeachers = visibleToTeachers === 'true';
            notice.teacherSections = teacherSections ? 
                (Array.isArray(teacherSections) ? teacherSections : [teacherSections]) : 
                notice.teacherSections;
        }
        
        // If there's a new attachment, replace the old one
        if (req.file) {
            // Delete old attachment if it exists
            if (notice.attachment) {
                const oldFilePath = path.join(__dirname, '..', 'public', notice.attachment);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
            notice.attachment = writeUploadToDisk(req.file.buffer, req.file.originalname);
        }

        await notice.save();
        res.json(notice);
    } catch (error) {
        console.error('Error updating notice:', error);
        res.status(500).json({ message: 'Error updating notice', error: error.message });
    }
});

// Delete a notice
router.delete('/:id', protect, teacherOnly, async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);
        if (!notice) {
            return res.status(404).json({ message: 'Notice not found' });
        }

        // Ownership check: only the author (teacher who created it) or admin can delete
        if (req.user.role !== 'admin' && notice.author !== req.user.name) {
            return res.status(403).json({ message: 'Not authorized to delete this notice' });
        }

        // Delete attachment if it exists
        if (notice.attachment) {
            const filePath = path.join(__dirname, '..', 'public', notice.attachment);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await Notice.findByIdAndDelete(req.params.id);
        res.json({ message: 'Notice deleted successfully' });
    } catch (error) {
        console.error('Error deleting notice:', error);
        res.status(500).json({ message: 'Error deleting notice', error: error.message });
    }
});

// Protected attachment download route
router.get('/attachment/:filename', protect, (req, res) => {
    const filename = path.basename(req.params.filename);
    
    // Only allow filenames matching the pattern from createSafeUploadFilename (timestamp-hex.ext)
    if (!/^[0-9]+-[a-f0-9]{32}\.[a-z]+$/.test(filename)) {
        return res.status(400).json({ message: 'Invalid filename' });
    }
    
    const uploadDir = path.resolve(__dirname, '..', 'public', 'uploads', 'notices');
    const filePath = path.resolve(uploadDir, filename);
    
    // Verify resolved path is within the intended directory
    if (!filePath.startsWith(uploadDir)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ message: 'Attachment not found' });
    }
});

export default router;