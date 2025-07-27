// import pool from '../config/db.js';

// exports.getComplaintByStudent = async (student_id) => {
//   const result = await pool.query(
//     'SELECT * FROM complaint WHERE student_id = $1 ORDER BY date DESC',
//     [student_id]
//   );
//   return result.rows;
// };

// exports.addComplaint = async (student_id, subject, description) => {
//   const result = await pool.query(
//     'INSERT INTO complaint (student_id, subject, description, date) VALUES ($1, $2, $3, NOW()) RETURNING *',
//     [student_id, subject, description]
//   );
//   return result.rows[0];
// };

/////esm////

import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: function() { return !this.isTeacherComplaint; }
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() { return this.isTeacherComplaint; }
    },
    isTeacherComplaint: {
        type: Boolean,
        default: false,
        index: true
    },
    subject: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['academic', 'infrastructure', 'staff', 'administration', 'other'],
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'resolved', 'rejected'],
        default: 'pending'
    },
    sendToTeacher: {
        type: Boolean,
        default: false
    },
    assignedTeacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    responses: [{
        responder: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        message: {
            type: String,
            required: true
        },
        responseDate: {
            type: Date,
            default: Date.now
        }
    }],
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    resolvedDate: Date,
    attachments: [{
        filename: String,
        path: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Indexes for efficient queries
complaintSchema.index({ student: 1, status: 1, createdAt: -1 });
complaintSchema.index({ sendToTeacher: 1 });
complaintSchema.index({ assignedTeacher: 1 });

// Static method to get complaints by student
complaintSchema.statics.getComplaintsByStudent = async function(studentId) {
    return this.find({ student: studentId })
        .populate('student', 'name rollNumber')
        .populate('assignedTo', 'name')
        .populate('assignedTeacher', 'name role')
        .populate('responses.responder', 'name role')
        .sort('-createdAt');
};

// Static method to add complaint
complaintSchema.statics.addComplaint = async function(complaintData) {
    return this.create(complaintData);
};

// Static method to get pending complaints
complaintSchema.statics.getPendingComplaints = async function() {
    return this.find({ status: { $in: ['pending', 'in_progress'] } })
        .populate('student', 'name rollNumber class section')
        .populate('assignedTo', 'name')
        .sort('-priority -createdAt');
};

// Method to add response
complaintSchema.methods.addResponse = async function(responseData) {
    this.responses.push(responseData);
    if (responseData.status) {
        this.status = responseData.status;
        if (responseData.status === 'resolved') {
            this.resolvedDate = new Date();
        }
    }
    return this.save();
};

const Complaint = mongoose.model('Complaint', complaintSchema);

// Export both the model and its static methods
export const getComplaintsByStudent = Complaint.getComplaintsByStudent.bind(Complaint);
export const addComplaint = Complaint.addComplaint.bind(Complaint);
export const getPendingComplaints = Complaint.getPendingComplaints.bind(Complaint);
export default Complaint;