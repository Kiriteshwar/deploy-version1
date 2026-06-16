import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWT_SECRET } from '../config/auth.js';
import User from '../models/userModel.js';
import Student from '../models/studentModel.js';
import Teacher from '../models/teacherModel.js';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../services/emailService.js';
import { normalizeEmail, sanitizeText } from '../utils/security.js';

const debugLog = (...args) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(...args);
    }
};

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: '1h'
    });
};

const setAuthCookie = (res, token) => {
    res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000,
        path: '/'
    });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' });
        }

        // Find user and explicitly select the password field
        const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.isLocked()) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        // Use the model's matchPassword method
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            await user.incrementLoginAttempts();
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Reset login attempts on successful login
        await user.resetLoginAttempts();

        if ((user.role === 'student' || user.role === 'teacher') && user.isActive === false) {
            return res.status(403).json({
                success: false,
                message: 'Your account is no longer active. Please contact administration.'
            });
        }

        // Generate token
        const token = generateToken(user._id);
        setAuthCookie(res, token);

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        return res.status(200).json({
            success: true,
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            message: 'Something went wrong during login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Return role-specific data based on user type
    let roleData = {};
    if (user.role === 'student' && user.studentInfo) {
        roleData = {
            class: user.studentInfo.class,
            section: user.studentInfo.section,
            rollNumber: user.studentInfo.rollNumber
        };
    } else if (user.role === 'teacher' && user.teacherInfo) {
        roleData = {
            subjects: user.teacherInfo.subjects,
            classTeacher: user.teacherInfo.classTeacher
        };
    } else if (user.role === 'admin' && user.adminInfo) {
        roleData = {
            designation: user.adminInfo.designation,
            permissions: user.adminInfo.permissions
        };
    }

    res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        roleData
    });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    
    // Handle phone number updates
    if (req.body.phone) {
        user.phone = req.body.phone;
        
        // For students, also update guardianPhone to keep them in sync
        if (user.role === 'student' && user.studentInfo) {
            user.studentInfo.guardianPhone = req.body.phone;
            debugLog(`Syncing phone numbers for student ${user.name}`);
        }
    }

    if (req.body.password) {
        user.password = req.body.password;  // Let User model pre-save hook hash it
    }

    const updatedUser = await user.save();

    res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        success: true
    });
});

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const genericMessage = 'If the account exists, a password reset link has been sent.';
    const user = await User.findOne({ email });
    
    if (!user) {
        return res.json({ message: genericMessage });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`}/reset-password/${resetToken}`;
    await sendEmail({
        to: user.email,
        subject: 'Password reset request',
        html: `<p>A password reset was requested for your St. Mary's Portal account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 10 minutes.</p>`
    });

    res.json({ message: genericMessage });
});

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = asyncHandler(async (req, res) => {
    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
        res.status(400);
        throw new Error('Token is invalid or has expired');
    }

    const newPassword = req.body.password;
    if (!newPassword || newPassword.length < 8) {
        res.status(400);
        throw new Error('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        res.status(400);
        throw new Error('Password must contain at least one uppercase letter and one number');
    }
    
    user.password = newPassword;  // Let User model pre-save hook hash it
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({
        message: 'Password reset successful'
    });
});

// @desc    Get users by role
// @route   GET /api/auth/users
// @access  Private (Admin only)
export const getUsersByRole = asyncHandler(async (req, res) => {
    try {
        debugLog('Getting users by role');
        const { role } = req.query;
        
        // Validate role if provided
        if (role && !['admin', 'teacher', 'student'].includes(role)) {
            return res.status(400).json({
                message: "Invalid role specified. Must be 'admin', 'teacher', or 'student'"
            });
        }
        
        const query = role ? { role } : {};
        
        // Find users matching the query
        const users = await User.find(query).select('-password');
        
        debugLog(`Found ${users.length} users with role: ${role || 'all'}`);
        
        res.status(200).json({
            message: `Users with role '${role || 'all'}' retrieved successfully`,
            users
        });
    } catch (error) {
        console.error('Error fetching users by role:', error);
        res.status(500).json({
            message: "Failed to retrieve users",
            error: error.message
        });
    }
});