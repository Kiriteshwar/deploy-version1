import Result from '../models/resultsModel.js';
import Exam from '../models/examModel.js';
import { validateResult } from '../utils/validation.js';

// Create or update result
export const createOrUpdateResult = async (req, res) => {
    try {
        const { examId, studentId } = req.body;
        
        // Check if exam exists and is active
        const exam = await Exam.findById(examId);
        if (!exam || !exam.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found or inactive'
            });
        }

        // Validate result data
        const resultData = {
            ...req.body,
            exam: examId,
            student: studentId,
            class: req.body.class,      // Use class from request
            section: req.body.section,  // Use section from request
            declaredBy: req.user._id,
            academicYear: exam.academicYear
        };

        const { error } = validateResult(resultData);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Remove calculation logic for obtainedTotal, percentage, and grade
        // Only save marks and essential details
        // Find existing result or create new one
        let result = await Result.findOne({ exam: examId, student: studentId });
        if (result) {
            // Update or add the subject in the marks array
            const newMark = resultData.marks[0];
            const existingIndex = result.marks.findIndex(
                m => m.subjectId.toString() === newMark.subjectId.toString()
            );
            if (existingIndex !== -1) {
                // Update existing subject's marks
                result.marks[existingIndex] = newMark;
            } else {
                // Add new subject marks
                result.marks.push(newMark);
            }
            result.markModified('marks');
            // Update other fields if needed
            result.class = resultData.class;
            result.section = resultData.section;
            result.declaredBy = resultData.declaredBy;
            result.academicYear = resultData.academicYear;
            result.exam = resultData.exam;
            result.student = resultData.student;
        } else {
            // Create new result
            result = new Result(resultData);
        }
        console.log('Result data before save:', resultData);
        console.log('Final result before save:', result);
        await result.save();
        await result.populate('student', 'name rollNumber');

        res.json({
            success: true,
            message: result.isNew ? 'Result created successfully' : 'Result updated successfully',
            data: result
        });
    } catch (error) {
        console.error('Error in createOrUpdateResult:', error); // Added error logging
        res.status(500).json({
            success: false,
            message: 'Error saving result',
            error: error.message
        });
    }
};

// Get student's own results
export const getStudentResults = async (req, res) => {
    try {
        const studentId = req.user._id;
        const { academicYear } = req.query;

        const filter = { student: studentId };
        if (academicYear) filter.academicYear = academicYear;

        const results = await Result.getResultsByStudent(studentId);

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching student results',
            error: error.message
        });
    }
};

// Get results by exam (for teachers and admin)
export const getResultsByExam = async (req, res) => {
    try {
        const { examId } = req.params;
        const { class: className, section } = req.query;

        const filter = { exam: examId };
        if (className) filter.class = className;
        if (section) filter.section = section;

        const results = await Result.find(filter)
            .populate('student', 'name rollNumber')
            .populate('exam', 'name examType')
            .populate('declaredBy', 'name')
            .sort('-percentage');

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching results',
            error: error.message
        });
    }
};

// Get class results with statistics
export const getClassResults = async (req, res) => {
    try {
        const { examId } = req.params;
        const { class: className, section } = req.body;

        const results = await Result.getClassResults(examId, { class: className, section });

        // Calculate class statistics
        const totalStudents = results.length;
        const passCount = results.filter(r => r.grade !== 'F').length;
        const passPercentage = (passCount / totalStudents) * 100;

        const gradeDistribution = {
            'A+': results.filter(r => r.grade === 'A+').length,
            'A': results.filter(r => r.grade === 'A').length,
            'B': results.filter(r => r.grade === 'B').length,
            'C': results.filter(r => r.grade === 'C').length,
            'D': results.filter(r => r.grade === 'D').length,
            'F': results.filter(r => r.grade === 'F').length
        };

        res.json({
            success: true,
            data: {
                results,
                statistics: {
                    totalStudents,
                    passCount,
                    passPercentage,
                    gradeDistribution
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching class results',
            error: error.message
        });
    }
};

// Declare result (make it visible to students)
export const declareResult = async (req, res) => {
    try {
        const { examId } = req.params;

        const exam = await Exam.findById(examId);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        exam.resultDeclared = true;
        await exam.save();

        res.json({
            success: true,
            message: 'Result declared successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error declaring result',
            error: error.message
        });
    }
};
