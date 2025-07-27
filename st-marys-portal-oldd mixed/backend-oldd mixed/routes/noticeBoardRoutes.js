import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { protect, teacherOnly } from '../middleware/authMiddleware.js';
import Notice from '../models/noticeboardModel.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up storage for attachments
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/uploads/notices';
        // Create directory if it doesn't exist
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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
    fileFilter: function (req, file, cb) {
        // Accept common file types
        const filetypes = /pdf|doc|docx|jpg|jpeg|png|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF, Word documents, and image files are allowed!'));
        }
    }
});

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
                // Always show notices created by this teacher
                if (notice.author.includes(req.user.name)) {
                    return true;
                }
                
                // If teacher has no assigned sections and is not a class teacher, only show general notices
                if (teacherNoticeSections.length === 0) {
                    return notice.targetClass === 'all' && notice.targetSection === 'all';
                }
                
                // Show general notices
                if (notice.targetClass === 'all' && notice.targetSection === 'all') {
                    return true;
                }
                
                // Show notices for teacher's assigned class-section combinations
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
        
        // If the user is a student, filtering will be handled client-side
        // Admin sees all notices
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
        
        const notice = new Notice({
            title,
            content,
            category,
            date: date || Date.now(),
            author: author || req.user.name || 'Admin',
            important: important === 'true',
            attachment: req.file ? `uploads/notices/${req.file.filename}` : null,
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

        // Update notice fields
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
            
            notice.attachment = `uploads/notices/${req.file.filename}`;
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

// Route to get an attachment
router.get('/attachment/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '..', 'public', 'uploads', 'notices', filename);
    
    console.log('Attachment requested:', filename);
    console.log('Looking for file at:', filePath);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        console.error('Attachment not found at path:', filePath);
        res.status(404).json({ message: 'Attachment not found' });
    }
});

export default router;
