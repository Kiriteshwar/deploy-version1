import mongoose from 'mongoose';

const examSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    examType: {
        type: String,
        required: true,
        enum: ['unit_test', 'mid_term', 'final_term', 'practical']
    },
    classSections: [{
        class: { type: String, required: true },
        section: { type: String, required: true }
    }],
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    subjects: [{
        name: {
            type: String,
            required: true
        },
        maxMarks: {
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
    resultDeclared: {
        type: Boolean,
        default: false
    },
    createdBy: {
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
// examSchema.index({ classes: 1, sections: 1 });
examSchema.index({ examType: 1 });
examSchema.index({ startDate: 1, endDate: 1 });
examSchema.index({ resultDeclared: 1 });

// Static method to get active exams for a class and section
examSchema.statics.getActiveExams = async function(classId, section) {
    const today = new Date();
    return this.find({
        classSections: { $elemMatch: { class: classId, section: section } },
        startDate: { $lte: today },
        endDate: { $gte: today }
    }).sort('startDate');
};

// Static method to get upcoming exams
examSchema.statics.getUpcomingExams = async function(classId, section) {
    const today = new Date();
    return this.find({
        classSections: { $elemMatch: { class: classId, section: section } },
        startDate: { $gt: today }
    }).sort('startDate');
};

// Static method to get completed exams
examSchema.statics.getCompletedExams = async function(classId, section) {
    const today = new Date();
    return this.find({
        classSections: { $elemMatch: { class: classId, section: section } },
        endDate: { $lt: today }
    }).sort('-endDate');
};

// Virtual for total marks
examSchema.virtual('totalMarks').get(function() {
    return this.subjects.reduce((total, subject) => total + subject.maxMarks, 0);
});

// Method to check if exam is active
examSchema.methods.isActive = function() {
    const today = new Date();
    return this.startDate <= today && this.endDate >= today;
};

const Exam = mongoose.model('Exam', examSchema);

export default Exam;
