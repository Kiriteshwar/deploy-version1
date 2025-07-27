import mongoose from 'mongoose';

const timetableSchema = new mongoose.Schema({
    class: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    dayOfWeek: {
        type: Number,
        required: true,
        min: 0,
        max: 6
    },
    period: {
        type: Number,
        required: true,
        min: 1,
        max: 8
    },
    subject: {
        type: String,
        required: true
    },
    teacher: {
        type: String,
        required: true
    },
    room: {
        type: String,
        required: false
    },
    academicYear: {
        type: String,
        required: true,
        default: new Date().getFullYear().toString()
    },
    semester: {
        type: String,
        default: '1'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
timetableSchema.index({ 
    class: 1, 
    section: 1, 
    dayOfWeek: 1, 
    period: 1,
    academicYear: 1,
    semester: 1 
}, { unique: true });

// Method to find current timetable entry
timetableSchema.statics.findCurrentEntry = async function(classInfo, date) {
    const dayOfWeek = new Date(date).getDay();
    return this.findOne({
        class: classInfo.class,
        section: classInfo.section,
        dayOfWeek: dayOfWeek
    }).populate('assignedTeacher', 'name');
};

// Method to check if teacher is allowed to take class
timetableSchema.methods.canTeacherSubstitute = async function(teacherId) {
    if (!this.assignedTeacher || (this.assignedTeacher && this.assignedTeacher.equals(teacherId))) 
        return true;
    
    const substitute = this.allowedSubstitutes.find(s => 
        s.teacher && s.teacher.equals(teacherId)
    );
    
    return !!substitute;
};

const Timetable = mongoose.model('Timetable', timetableSchema, 'timetables');

export default Timetable; 