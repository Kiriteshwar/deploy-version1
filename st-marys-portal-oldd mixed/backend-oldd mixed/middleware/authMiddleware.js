// import jwt from 'jsonwebtoken';
// import { JWT_SECRET } from '../config/auth';

// const authenticateToken = (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];

//   if (!token) return res.sendStatus(401);

//   jwt.verify(token, JWT_SECRET, (err, user) => {
//     if (err) return res.sendStatus(403);
//     req.user = user;
//     next();
//   });
// };

// export default authenticateToken;

// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import { JWT_SECRET } from '../config/auth.js';
import User from '../models/userModel.js';

const getCookieToken = (req) => {
    const cookieHeader = req.headers.cookie || '';
    const cookies = Object.fromEntries(cookieHeader.split(';').map((cookie) => {
        const [key, ...value] = cookie.trim().split('=');
        return [key, decodeURIComponent(value.join('='))];
    }).filter(([key]) => key));
    return cookies.auth_token;
};

// Protect routes
export const protect = asyncHandler(async (req, res, next) => {
    // console.log('protect middleware called');
    // console.log('req.user at start of protect:', req.user);
    let token;

    // Check for token in Authorization header or HttpOnly cookie
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        if (token === 'cookie' || token === 'null' || token === 'undefined') {
            token = undefined;
        }
    }

    if (!token) {
        token = getCookieToken(req);
    }

    if (token) {
        try {
            // Verify token
            const decoded = jwt.verify(token, JWT_SECRET);

            // Get user from database (exclude password)
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                res.status(401);
                throw new Error('User not found');
            }

            // Block inactive students from accessing any protected route
            if ((req.user.role === 'student' || req.user.role === 'teacher') && req.user.isActive === false) {
                res.status(403);
                throw new Error('Account inactive');
            }

            next();
        } catch (error) {
            res.status(401);
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token expired, please log in again');
            }
            throw new Error('Not authorized');
        }
    } else {
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});

// Role authorization middleware
export const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401);
            throw new Error('Not authorized, no user');
        }

        // Convert single role to array
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (allowedRoles.includes(req.user.role)) {
            next();
        } else {
            res.status(403);
            throw new Error(`Not authorized as ${allowedRoles.join(' or ')}`);
        }
    };
};

// Admin only middleware
export const adminOnly = asyncHandler(async (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403);
        throw new Error('Not authorized as admin');
    }
});

// Teacher only middleware
export const teacherOnly = asyncHandler(async (req, res, next) => {
    if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(403);
        throw new Error('Not authorized as teacher');
    }
});

// Student only middleware
export const studentOnly = asyncHandler(async (req, res, next) => {
    if (req.user && req.user.role === 'student') {
        next();
    } else {
        res.status(403);
        throw new Error('Not authorized as student');
    }
});

