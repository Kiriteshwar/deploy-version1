import mongoose from 'mongoose';

const disciplineSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    incidentDate: {
        type: Date,
        required: true
    },
    category: {
        type: String,
        enum: ['behavioral', 'academic', 'attendance', 'uniform', 'other'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        enum: ['minor', 'moderate', 'major', 'severe'],
        required: true
    },
    reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
    },
    witnesses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    actionTaken: {
        type: String,
        enum: ['warning', 'detention', 'parent_meeting', 'suspension', 'other'],
        required: true
    },
    duration: {
        startDate: Date,
        endDate: Date
    },
    parentNotified: {
        status: {
            type: Boolean,
            default: false
        },
        date: Date,
        method: {
            type: String,
            enum: ['phone', 'email', 'letter', 'in_person']
        }
    },
    followUp: [{
        date: {
            type: Date,
            required: true
        },
        notes: String,
        conductedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Teacher'
        }
    }],
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'resolved', 'escalated'],
        default: 'pending'
    },
    attachments: [{
        filename: String,
        path: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    remarks: String
}, {
    timestamps: true
});

// Indexes for efficient queries
disciplineSchema.index({ student: 1, incidentDate: -1 });
disciplineSchema.index({ category: 1, severity: 1 });

// Static method to get discipline records by student
disciplineSchema.statics.getStudentRecords = async function(studentId) {
    return this.find({ student: studentId })
        .populate('student', 'name rollNumber class section')
        .populate('reportedBy', 'name')
        .populate('witnesses', 'name role')
        .sort('-incidentDate');
};

// Static method to add discipline record
disciplineSchema.statics.addRecord = async function(recordData) {
    return this.create(recordData);
};

// Static method to get records by severity
disciplineSchema.statics.getRecordsBySeverity = async function(severity) {
    return this.find({ severity })
        .populate('student', 'name rollNumber class section')
        .populate('reportedBy', 'name')
        .sort('-incidentDate');
};

// Method to add follow-up
disciplineSchema.methods.addFollowUp = async function(followUpData) {
    this.followUp.push(followUpData);
    return this.save();
};

// Method to update parent notification
disciplineSchema.methods.updateParentNotification = async function(notificationData) {
    this.parentNotified = {
        ...this.parentNotified,
        ...notificationData,
        status: true,
        date: new Date()
    };
    return this.save();
};

const Discipline = mongoose.model('Discipline', disciplineSchema);

export default Discipline;
