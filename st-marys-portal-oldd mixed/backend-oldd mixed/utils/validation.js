// Validation utility functions for exam and result management

// Validate exam creation data
export function validateExamData(examData) {
    const errors = [];

    // Check required fields
    if (!examData.name || typeof examData.name !== 'string' || examData.name.trim().length === 0) {
        errors.push('Valid exam name is required');
    }

    if (!examData.examType || !['unit_test', 'mid_term', 'final_term', 'practical'].includes(examData.examType)) {
        errors.push('Valid exam type is required');
    }

    // Validate classes and sections
    if (!Array.isArray(examData.classes) || examData.classes.length === 0) {
        errors.push('At least one class must be selected');
    }

    if (!Array.isArray(examData.sections) || examData.sections.length === 0) {
        errors.push('At least one section must be selected');
    }

    // Validate dates
    const startDate = new Date(examData.startDate);
    const endDate = new Date(examData.endDate);
    const today = new Date();

    if (isNaN(startDate.getTime())) {
        errors.push('Valid start date is required');
    }

    if (isNaN(endDate.getTime())) {
        errors.push('Valid end date is required');
    }

    if (startDate > endDate) {
        errors.push('Start date cannot be after end date');
    }

    // Validate subjects
    if (!Array.isArray(examData.subjects) || examData.subjects.length === 0) {
        errors.push('At least one subject is required');
    } else {
        examData.subjects.forEach((subject, index) => {
            if (!subject.name || typeof subject.name !== 'string' || subject.name.trim().length === 0) {
                errors.push(`Subject ${index + 1}: Valid subject name is required`);
            }

            if (!subject.maxMarks || isNaN(subject.maxMarks) || subject.maxMarks <= 0) {
                errors.push(`Subject ${index + 1}: Valid maximum marks are required`);
            }

            if (!subject.passingMarks || isNaN(subject.passingMarks) || subject.passingMarks <= 0) {
                errors.push(`Subject ${index + 1}: Valid passing marks are required`);
            }

            if (subject.passingMarks > subject.maxMarks) {
                errors.push(`Subject ${index + 1}: Passing marks cannot be greater than maximum marks`);
            }
        });
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// Validate result data
export function validateResult(resultData) {
    const errors = [];

    // Check required fields
    if (!resultData.examId) {
        errors.push('Exam ID is required');
    }

    if (!resultData.studentId) {
        errors.push('Student ID is required');
    }

    // Validate marks
    if (!Array.isArray(resultData.marks) || resultData.marks.length === 0) {
        errors.push('Subject marks are required');
    } else {
        resultData.marks.forEach((mark, index) => {
            if (!mark.subjectId) {
                errors.push(`Subject ${index + 1}: Subject ID is required`);
            }

            if (isNaN(mark.obtainedMarks) || mark.obtainedMarks < 0) {
                errors.push(`Subject ${index + 1}: Valid obtained marks are required`);
            }

            if (mark.maxMarks && mark.obtainedMarks > mark.maxMarks) {
                errors.push(`Subject ${index + 1}: Obtained marks cannot exceed maximum marks`);
            }
        });
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// Validate student ID format
export function validateStudentId(studentId) {
    // Assuming student ID format: YYYY-CLASS-SECTION-NNN
    const studentIdRegex = /^\d{4}-[A-Z0-9]+-[A-Z]-\d{3}$/;
    return studentIdRegex.test(studentId);
}

// Sanitize and validate marks input
export function sanitizeMarks(marks) {
    if (typeof marks !== 'number' && typeof marks !== 'string') {
        return null;
    }

    const sanitizedMarks = parseFloat(marks);
    if (isNaN(sanitizedMarks) || sanitizedMarks < 0) {
        return null;
    }

    return sanitizedMarks;
}

// Validate date range
export function validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
            isValid: false,
            error: 'Invalid date format'
        };
    }

    if (start > end) {
        return {
            isValid: false,
            error: 'Start date cannot be after end date'
        };
    }

    return {
        isValid: true,
        error: null
    };
} 