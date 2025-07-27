import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    // Common fields for all users
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    phone: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true,
        enum: ['admin', 'teacher', 'student']
    },
    profilePhoto: {
        type: String,
        default: 'default-avatar.jpg'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: Date,

    // Student specific fields
    studentInfo: {
        type: {
            class: String,
            section: String,
            rollNumber: {
                type: String,
                unique: true,
                sparse: true
            },
            guardianName: String,
            guardianPhone: String,
            address: String
        },
        required: function() { return this.role === 'student'; }
    },
    // Flat discount amount (applies only if role is student)
    discount: {
        type: Number,
        default: 0,
        // Only used for students; ignored for others
    },

    // Teacher specific fields
    teacherInfo: {
        type: {
            subjects: [String],
            qualifications: [{
                degree: String,
                institution: String,
                year: Number
            }],
            classTeacher: {
                class: String,
                section: String
            },
            noticeSections: {
                type: [String],
                default: []
            }
        },
        required: function() { return this.role === 'teacher'; }
    },

    // Admin specific fields
    adminInfo: {
        type: {
            designation: String,
            permissions: [String]
        },
        required: function() { return this.role === 'admin'; }
    },

    // Common optional fields
    dateOfBirth: Date,
    gender: String,
    joinDate: {
        type: Date,
        default: Date.now
    },
    notificationPreferences: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    try {
        // Handle password hashing
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }

        // Handle discount validation
        if (this.role === 'student') {
            // For students, ensure discount is always initialized and valid
            if (typeof this.discount !== 'number' || this.discount < 0) {
                this.discount = 0;
            }
        } else {
            // Non-students should not have a discount
            this.discount = 0;
        }

        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.matchPassword = async function(enteredPassword) {
    try {
        if (!this.password) {
            throw new Error('Password field not selected');
        }
        return await bcrypt.compare(enteredPassword, this.password);
    } catch (error) {
        console.error('Password comparison error:', error);
        return false;
    }
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    return resetToken;
};

// Check if account is locked
userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return await this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }
    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
        updates.$set = {
            lockUntil: Date.now() + 1 * 60 * 60 * 1000 // 1 hour lock
        };
    }
    return await this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 }
    });
};

const User = mongoose.model('User', userSchema);

export default User; 