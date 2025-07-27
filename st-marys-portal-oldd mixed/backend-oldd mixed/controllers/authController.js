import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/auth.js';
import User from '../models/userModel.js';
import Student from '../models/studentModel.js';
import Teacher from '../models/teacherModel.js';
import bcrypt from 'bcryptjs';

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', { email, passwordProvided: !!password });

        if (!email || !password) {
            console.log('Missing credentials:', { email: !!email, password: !!password });
            return res.status(400).json({ message: 'Please provide email and password' });
        }

        // Find user and explicitly select the password field
        const user = await User.findOne({ email }).select('+password');
        console.log('User found:', !!user);

        if (!user) {
            console.log('User not found:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Use the model's matchPassword method
        const isMatch = await user.matchPassword(password);
        console.log('Password match result:', isMatch);

        if (!isMatch) {
            console.log('Password mismatch for:', email);
            await user.incrementLoginAttempts();
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check if account is locked
        if (user.isLocked()) {
            console.log('Account locked for:', email);
            return res.status(401).json({ 
                message: 'Account is temporarily locked. Please try again later.' 
            });
        }

        // Reset login attempts on successful login
        await user.resetLoginAttempts();

        // Generate token
        const token = generateToken(user._id);
        console.log('Token generated successfully');

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        return res.status(200).json({
            success: true,
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token
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

    if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await user.save();

    res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
    });
});

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    
    if (!user) {
        res.status(404);
        throw new Error('No user found with this email');
    }

    const resetToken = user.createPasswordResetToken();
    await user.save();

    // TODO: Send reset token via email
    // For development, we'll just return it
    res.json({
        message: 'Password reset token generated',
        resetToken
    });
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
    });

    if (!user) {
        res.status(400);
        throw new Error('Token is invalid or has expired');
    }

    user.password = req.body.password;
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
        console.log('Getting users by role');
        const { role } = req.query;
        
        // Validate role if provided
        if (role && !['admin', 'teacher', 'student'].includes(role)) {
            return res.status(400).json({
                message: "Invalid role specified. Must be 'admin', 'teacher', or 'student'"
            });
        }
        
        // Build query
        const query = role ? { role } : {};
        
        // Find users matching the query
        const users = await User.find(query).select('-password');
        
        console.log(`Found ${users.length} users with role: ${role || 'all'}`);
        
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