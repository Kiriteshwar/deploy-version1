import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
    exam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    class: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    marks: [{
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        subjectName: {
            type: String,
            required: true
        },
        maxMarks: {
            type: Number,
            required: true,
            min: 0
        },
        obtainedMarks: {
            type: Number,
            required: true,
            min: 0
        },
        passingMarks: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    totalMarks: { type: Number, min: 0 },
    obtainedTotal: {
        type: Number,
        min: 0
    },
    percentage: {
        type: Number,
        min: 0,
        max: 100
    },
    grade: {
        type: String,
        enum: ['A+', 'A', 'B', 'C', 'D', 'F']
    },
    remarks: String,
    declaredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    academicYear: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Add indexes for common queries
resultSchema.index({ exam: 1, student: 1 }, { unique: true });
resultSchema.index({ class: 1, section: 1 });
resultSchema.index({ student: 1, academicYear: 1 });

// Calculate grade based on percentage
function calculateGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}

// Pre-save middleware to calculate totals and grade

// Static method to get results by student
resultSchema.statics.getResultsByStudent = async function(studentId) {
    return this.find({ student: studentId })
        .populate('exam', 'name examType')
        .populate('declaredBy', 'name')
        .sort('-createdAt');
};

// Static method to get class results
resultSchema.statics.getClassResults = async function(examId, filter = {}) {
    return this.find({
        exam: examId,
        ...filter
    })
    .populate('student', 'name rollNumber')
    .sort('-percentage');
};

// Virtual for pass/fail status
resultSchema.virtual('isPassed').get(function() {
    return this.marks.every(mark => mark.obtainedMarks >= mark.passingMarks);
});

const Result = mongoose.model('Result', resultSchema);

export default Result;
