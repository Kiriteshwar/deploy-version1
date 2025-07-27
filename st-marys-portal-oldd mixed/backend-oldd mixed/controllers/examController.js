import Exam from '../models/examModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Create a new exam
// @route   POST /api/exams
// @access  Private (Admin, Teacher)
export const createExam = asyncHandler(async (req, res) => {
    try {
        req.body.createdBy = req.user._id;
        const exam = await Exam.create(req.body);
        res.status(201).json({
            success: true,
            data: exam
        });
    } catch (error) {
        console.error('Exam creation error:', error);
        res.status(400).json({
            success: false,
            message: error.message,
            error: error.errors || error
        });
    }
});

// @desc    Get all exams
// @route   GET /api/exams
// @access  Private (Admin, Teacher)
export const getExams = asyncHandler(async (req, res) => {
    const exams = await Exam.find({});
    res.json({
        success: true,
        data: exams
    });
});

// @desc    Get exam by ID
// @route   GET /api/exams/:id
// @access  Private (Admin, Teacher)
export const getExamById = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (exam) {
        res.json({
            success: true,
            data: exam
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Exam not found'
        });
    }
});

// @desc    Update exam
// @route   PUT /api/exams/:id
// @access  Private (Admin, Teacher)
export const updateExam = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (exam) {
        Object.assign(exam, req.body);
        const updatedExam = await exam.save();
        res.json({
            success: true,
            data: updatedExam
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Exam not found'
        });
    }
});

// @desc    Delete exam
// @route   DELETE /api/exams/:id
// @access  Private (Admin)
export const deleteExam = asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (exam) {
        await exam.deleteOne();
        res.json({
            success: true,
            message: 'Exam removed'
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Exam not found'
        });
    }
});

// @desc    Get active exams
// @route   GET /api/exams/active
// @access  Private (All roles)
export const getActiveExams = asyncHandler(async (req, res) => {
    const currentDate = new Date();
    const exams = await Exam.find({
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate }
    });
    res.json({
        success: true,
        data: exams
    });
});

// @desc    Get upcoming exams
// @route   GET /api/exams/upcoming
// @access  Private (All roles)
export const getUpcomingExams = asyncHandler(async (req, res) => {
    const currentDate = new Date();
    const exams = await Exam.find({
        startDate: { $gt: currentDate }
    });
    res.json({
        success: true,
        data: exams
    });
});

// @desc    Get completed exams
// @route   GET /api/exams/completed
// @access  Private (All roles)
export const getCompletedExams = asyncHandler(async (req, res) => {
    const currentDate = new Date();
    const exams = await Exam.find({
        endDate: { $lt: currentDate }
    });
    res.json({
        success: true,
        data: exams
    });
});
