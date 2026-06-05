import mongoose from 'mongoose';

const communicationLogSchema = new mongoose.Schema({
    // Recipient information
    recipientName: {
        type: String,
        required: true
    },
    recipientEmail: {
        type: String,
        lowercase: true,
        trim: true
    },
    recipientPhone: {
        type: String
    },

    // Notification type
    notificationType: {
        type: String,
        required: true,
        enum: ['absence', 'announcement', 'birthday', 'fees', 'custom', 'homework', 'circular', 'event', 'emergency', 'reminder'],
        default: 'custom'
    },

    // Message details
    subject: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },

    // Delivery details
    channel: {
        type: String,
        enum: ['email', 'whatsapp'],
        default: 'email'
    },
    status: {
        type: String,
        enum: ['sent', 'failed', 'pending', 'duplicate_prevented'],
        default: 'pending'
    },
    errorMessage: {
        type: String
    },

    // References
    studentRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    teacherRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    adminRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    sentAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for efficient queries
communicationLogSchema.index({ sentAt: -1 });
communicationLogSchema.index({ notificationType: 1, sentAt: -1 });
communicationLogSchema.index({ recipientEmail: 1 });
communicationLogSchema.index({ status: 1 });

const CommunicationLog = mongoose.model('CommunicationLog', communicationLogSchema);

export default CommunicationLog;