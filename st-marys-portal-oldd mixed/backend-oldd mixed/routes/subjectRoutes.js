import express from 'express';
import { protect, adminOnly, teacherOnly } from '../middleware/authMiddleware.js';
import Subject from '../models/subjectModel.js';

const router = express.Router();

// @desc    Get all subjects
// @route   GET /api/subjects/all
// @access  Private (teachers and admins)
router.get('/all', protect, async (req, res) => {
  try {
    const subjects = await Subject.find({}).sort({ name: 1 });
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ message: 'Failed to fetch subjects', error: error.message });
  }
});

// @desc    Get a single subject by ID
// @route   GET /api/subjects/:id
// @access  Private (teachers and admins)
router.get('/:id', protect, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    res.json(subject);
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ message: 'Failed to fetch subject', error: error.message });
  }
});

// @desc    Create a new subject
// @route   POST /api/subjects
// @access  Private (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, code, description, category } = req.body;
    
    // Check if subject already exists
    const subjectExists = await Subject.findOne({ name });
    if (subjectExists) {
      return res.status(400).json({ message: 'Subject with this name already exists' });
    }
    
    const subject = await Subject.create({
      name,
      code,
      description,
      category,
      isActive: true
    });
    
    res.status(201).json(subject);
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ message: 'Failed to create subject', error: error.message });
  }
});

// @desc    Update a subject
// @route   PUT /api/subjects/:id
// @access  Private (admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    
    subject.name = req.body.name || subject.name;
    subject.code = req.body.code || subject.code;
    subject.description = req.body.description || subject.description;
    subject.category = req.body.category || subject.category;
    subject.isActive = req.body.isActive !== undefined ? req.body.isActive : subject.isActive;
    
    const updatedSubject = await subject.save();
    res.json(updatedSubject);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ message: 'Failed to update subject', error: error.message });
  }
});

// @desc    Delete a subject
// @route   DELETE /api/subjects/:id
// @access  Private (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    
    await subject.deleteOne();
    res.json({ message: 'Subject removed' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ message: 'Failed to delete subject', error: error.message });
  }
});

export default router; 