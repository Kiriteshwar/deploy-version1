import express from 'express';
import Inquiry from '../models/inquiryModel.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @route   POST /api/inquiries
// @desc    Save a new inquiry (name, phone)
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone are required.' });
    }
    const inquiry = new Inquiry({ name, phone });
    await inquiry.save();
    res.status(201).json({ message: 'Inquiry submitted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit inquiry.', error: error.message });
  }
});

// @route   GET /api/inquiries
// @desc    Get all inquiries (admin only)
// @access  Private (Admin)
router.get('/', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    
    const inquiries = await Inquiry.find().sort({ createdAt: -1 });
    res.json({ inquiries });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch inquiries.', error: error.message });
  }
});

export default router;