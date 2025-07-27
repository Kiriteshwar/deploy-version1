import mongoose from 'mongoose';

const homeworkSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
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
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fileUrl: {
        type: String,
        required: false // Optional if homework is text-based
    },
    fileType: {
        type: String,
        enum: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'stl', 'obj', 'fbx', 'zip', 'rar', 'png', 'jpg', 'jpeg', null],
        required: false
    },
    expiryDate: {
        type: Date,
        required: true
    },
    allowSubmission: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Submission schema for student homework submissions
const submissionSchema = new mongoose.Schema({
    homework: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Homework',
        required: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'submitted', 'late', 'graded'],
        default: 'pending'
    },
    submissionDate: {
        type: Date
    },
    notes: {
        type: String,
        default: ''
    },
    attachments: [{
        filename: String,
        path: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    grade: {
        score: Number,
        feedback: String,
        gradedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        gradedAt: Date
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
homeworkSchema.index({ class: 1, expiryDate: 1 });
homeworkSchema.index({ teacher: 1 });
submissionSchema.index({ homework: 1, student: 1 }, { unique: true });

// Static methods for Homework
homeworkSchema.statics.getHomeworkByClass = async function(classId) {
    const currentDate = new Date();
    return this.find({
        class: classId,
        expiryDate: { $gt: currentDate },
        isActive: true
    })
    .populate('teacher', 'name')
    .sort({ expiryDate: 1 });
};

// Static methods for Submission
submissionSchema.statics.getStudentSubmissions = async function(studentId) {
    return this.find({ student: studentId })
        .populate('homework')
        .sort({ 'homework.expiryDate': -1 });
};

const Homework = mongoose.model('Homework', homeworkSchema);
const Submission = mongoose.model('Submission', submissionSchema);

export { Homework, Submission };

// import pool from '../config/db.js';

// // Add Homework
// exports.addHomework = async (student_id, subject, title, description, due_date, status) => {
//   const result = await pool.query(
//     'INSERT INTO homework (student_id, subject, title, description, due_date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
//     [student_id, subject, title, description, due_date, status]
//   );
//   return result.rows[0];
// };

// // Get Homework by Student ID
// exports.getHomeworkByStudent = async (student_id) => {
//   const result = await pool.query(
//     'SELECT * FROM homework WHERE student_id = $1 ORDER BY due_date ASC',
//     [student_id]
//   );
//   return result.rows;
// };

