import mongoose from 'mongoose';

const teacherAttendanceSchema = new mongoose.Schema({
    teacherName: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['present', 'absent'],
        required: true
    },
    reason: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
teacherAttendanceSchema.index({ 
    teacherName: 1, 
    date: 1
}, { unique: true });

const TeacherAttendance = mongoose.model('TeacherAttendance', teacherAttendanceSchema, 'teacherAttendance');

export default TeacherAttendance; 