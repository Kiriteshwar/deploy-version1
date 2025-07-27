import mongoose from 'mongoose';

const teacherAvailabilitySchema = new mongoose.Schema({
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    availabilityStatus: {
        type: String,
        enum: ['available', 'unavailable', 'leave', 'training'],
        default: 'available'
    },
    periods: [{
        period: {
            type: Number,
            required: true,
            min: 1,
            max: 8
        },
        status: {
            type: String,
            enum: ['free', 'class', 'substitute', 'other'],
            required: true
        },
        remarks: String
    }],
    reason: String
}, {
    timestamps: true
});

// Compound index for efficient queries
teacherAvailabilitySchema.index({ teacher: 1, date: 1 }, { unique: true });

// Method to check teacher availability for a specific period
teacherAvailabilitySchema.statics.isTeacherAvailable = async function(teacherId, date, period) {
    const availability = await this.findOne({
        teacher: teacherId,
        date: new Date(date)
    });

    if (!availability) return true; // No record means available by default

    if (availability.availabilityStatus !== 'available') return false;

    const periodStatus = availability.periods.find(p => p.period === period);
    return !periodStatus || periodStatus.status === 'free';
};

// Method to update teacher availability
teacherAvailabilitySchema.statics.updateAvailability = async function(teacherId, date, period, status, remarks = '') {
    const availability = await this.findOne({
        teacher: teacherId,
        date: new Date(date)
    });

    if (!availability) {
        return this.create({
            teacher: teacherId,
            date: new Date(date),
            periods: [{
                period,
                status,
                remarks
            }]
        });
    }

    const periodIndex = availability.periods.findIndex(p => p.period === period);
    if (periodIndex >= 0) {
        availability.periods[periodIndex] = { period, status, remarks };
    } else {
        availability.periods.push({ period, status, remarks });
    }

    return availability.save();
};

const TeacherAvailability = mongoose.model('TeacherAvailability', teacherAvailabilitySchema);

export default TeacherAvailability; 