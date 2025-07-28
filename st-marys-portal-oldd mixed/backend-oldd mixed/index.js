import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import colors from 'colors';
import morgan from 'morgan';
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import homeworkRoutes from './routes/homeworkRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import feesRoutes from './routes/feesRoutes.js';
import resultsRoutes from './routes/resultsRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import disciplineRoutes from './routes/disciplineRoutes.js';
import noticeRoutes from './routes/noticeBoardRoutes.js';
import timetableRoutes from './routes/timetableRoutes.js';
import subjectRoutes from './routes/subjectRoutes.js';
import examRoutes from './routes/examRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import inquiryRoutes from './routes/inquiryRoutes.js';

// Try to import error middleware from server.js if it exists
let notFound, errorHandler;
try {
    const errorMiddleware = await import('./middleware/errorMiddleware.js');
    notFound = errorMiddleware.notFound;
    errorHandler = errorMiddleware.errorHandler;
} catch (error) {
    // Define default error handlers if the import fails
    notFound = (req, res, next) => {
        const error = new Error(`Not Found - ${req.originalUrl}`);
        res.status(404);
        next(error);
    };
    
    errorHandler = (err, req, res, next) => {
        const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
        res.status(statusCode);
        res.json({
            message: err.message,
            stack: process.env.NODE_ENV === 'production' ? null : err.stack,
        });
    };
}

// Load env variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB with debug logging
console.log('Attempting to connect to MongoDB...'.yellow?.bold || 'Attempting to connect to MongoDB...');
try {
    await connectDB();
    console.log('MongoDB Connected successfully'.green?.bold || 'MongoDB Connected successfully');
} catch (error) {
    console.error('MongoDB connection error:'.red?.bold || 'MongoDB connection error:', error);
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    // Production logging with response size
    app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
}

// Add middleware to track large responses
app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
        if (data && JSON.stringify(data).length > 100000) { // Log responses > 100KB
            console.log(`Large response detected: ${req.method} ${req.url} - ${JSON.stringify(data).length} bytes`);
        }
        return originalSend.call(this, data);
    };
    next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/discipline', disciplineRoutes);
app.use('/api/notice', noticeRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inquiries', inquiryRoutes);

// Test route to verify server is running correct codebase
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Use error handling middleware from server.js if available, otherwise use existing
if (notFound && errorHandler) {
    app.use(notFound);
    app.use(errorHandler);
} else {
    // Error handling middleware (from original index.js)
    app.use((err, req, res, next) => {
        console.error('Error:', err.message);
        res.status(err.status || 500).json({
            message: err.message || 'Something went wrong!',
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    });

    // Handle 404 errors for API routes
    app.use('/api/*', (req, res) => {
        res.status(404).json({ message: 'API endpoint not found' });
    });
}

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`.green?.bold || 
                `Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
