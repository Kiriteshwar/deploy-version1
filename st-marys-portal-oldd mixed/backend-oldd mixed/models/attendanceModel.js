import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        validate: {
            validator: async function(userId) {
                const user = await mongoose.model('User').findById(userId);
                return user && user.role === 'student';
            },
            message: 'Referenced user must be a student'
        }
    },
    date: {
        type: Date,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Present', 'Absent', 'No Session'],
        required: true
    },
    period: {
        type: Number,
        required: true,
        min: 1,
        max: 8
    },
    markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        validate: {
            validator: async function(userId) {
                const user = await mongoose.model('User').findById(userId);
                return user && (user.role === 'teacher' || user.role === 'admin');
            },
            message: 'Only teachers and admins can mark attendance'
        }
    },
    remarks: {
        type: String
    },
    class: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Compound index for efficient queries with uniqueness constraint
attendanceSchema.index({ student: 1, date: 1, period: 1 }, { unique: true });

// Add a new index for class-section queries which is more commonly used
attendanceSchema.index({ class: 1, section: 1, date: 1 });

// Static method to mark attendance
attendanceSchema.statics.markAttendance = async function(attendanceData) {
    return this.create(attendanceData);
};

// Static method to get student attendance
attendanceSchema.statics.getAttendanceByStudent = async function(studentId, startDate, endDate) {
    return this.find({
        student: studentId,
        date: {
            $gte: startDate || new Date(0),
            $lte: endDate || new Date()
        }
    })
    .sort({ date: -1, period: 1 })
    .populate('markedBy', 'name')
    .populate('student', 'name studentInfo.rollNumber studentInfo.class studentInfo.section');
};

// Static method to get class attendance
attendanceSchema.statics.getClassAttendance = async function(classData, date) {
    return this.find({
        class: classData.class,
        section: classData.section,
        date: date
    })
    .populate('student', 'name studentInfo.rollNumber')
    .sort('student.studentInfo.rollNumber');
};

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance; 