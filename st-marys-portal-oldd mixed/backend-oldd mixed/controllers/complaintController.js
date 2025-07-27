// import complaintModel from '../models/complaintModel.js';

// exports.getComplaint = async (req, res) => {
//   try {
//     const student_id = req.user.id;
//     const records = await complaintModel.getComplaintByStudent(student_id);
//     res.json(records);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Server Error' });
//   }
// };

// exports.addComplaint = async (req, res) => {
//   try {
//     const student_id = req.user.id;
//     const { subject, description } = req.body;
//     const complaint = await complaintModel.addComplaint(student_id, subject, description);
//     res.json(complaint);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Server Error' });
//   }
// };
/////esm
import Complaint, { getComplaintsByStudent, addComplaint as addComplaintModel } from "../models/complaintModel.js";
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';

export async function getComplaint(req, res) {
    try {
        const student_id = req.user._id;
        // Use enhanced query to ensure we have all necessary data including responder roles
        const complaints = await Complaint.find({ student: student_id })
            .populate({
                path: 'student',
                select: 'name email role studentInfo',
                model: 'User'
            })
            .populate('assignedTo', 'name email role')
            .populate('assignedTeacher', 'name email role')
            .populate('responses.responder', 'name role')
            .sort('-createdAt');
        
        // Log for debugging
        console.log(`Found ${complaints.length} complaints for student ${student_id}`);
        
        res.json(complaints);
    } catch (error) {
        console.error("Error fetching student complaints:", error);
        res.status(500).json({ error: "Server Error" });
    }
}

export async function addComplaint(req, res) {
    try {
        const student_id = req.user._id;
        const { subject, description, category, priority, sendToTeacher, teacherId } = req.body;
        
        if (!subject || !description) {
            return res.status(400).json({ 
                error: "Please provide subject and description" 
            });
        }
        
        // Validate teacher selection if sendToTeacher is true
        if (sendToTeacher && !teacherId) {
            return res.status(400).json({
                error: "Please select a teacher for your complaint"
            });
        }
        
        const complaintData = {
            student: student_id,
            subject,
            description,
            category: category || 'other',
            priority: priority || 'medium',
            sendToTeacher: sendToTeacher || false,
            assignedTeacher: teacherId || null
        };
        
        const complaint = await addComplaintModel(complaintData);
        res.status(201).json(complaint);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
}

// Get all complaints for admin
export const getAllComplaints = asyncHandler(async (req, res) => {
    const { status, category, priority, audience, studentVisibility, teacherView } = req.query;
    
    console.log("Filter params received:", { status, category, priority, audience, studentVisibility, teacherView });
    
    // Build query based on filters
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    
    // Handle the enhanced filtering options
    if (req.user.role === 'admin') {
        // Admin can see all complaints
        // Filter by complaint type (from teachers or from students)
        if (audience === 'from-teachers') {
            query.isTeacherComplaint = true; // Show only complaints from teachers
        } else if (audience === 'from-students') {
            query.isTeacherComplaint = { $ne: true }; // Show only complaints from students
            
            // Further filter student complaints by visibility
            if (studentVisibility === 'teacher') {
                query.sendToTeacher = true;
            } else if (studentVisibility === 'admin-only') {
                query.sendToTeacher = false;
            }
            // If studentVisibility is not set or empty, don't filter further
        } else {
            // No specific audience filter or empty value - handle student visibility separately
            if (studentVisibility === 'teacher') {
                query.sendToTeacher = true;
                query.isTeacherComplaint = { $ne: true };
            } else if (studentVisibility === 'admin-only') {
                query.sendToTeacher = false;
                query.isTeacherComplaint = { $ne: true };
            }
            // If no filters set, show all complaints
        }
    } else if (req.user.role === 'teacher') {
        // Enhanced filtering for teachers based on teacherView parameter
        if (teacherView === 'my-complaints') {
            // Show only this teacher's complaints to admin
            query.teacher = req.user._id;
            query.isTeacherComplaint = true;
        } else if (teacherView === 'student-complaints') {
            // Show only student complaints assigned specifically to this teacher
            query.isTeacherComplaint = { $ne: true };
            query.assignedTeacher = req.user._id;
        } else {
            // Default 'all' view - Show only complaints relevant to this specific teacher
            query.$or = [
                // 1. Student complaints assigned specifically to this teacher
                { assignedTeacher: req.user._id, isTeacherComplaint: { $ne: true } },
                // 2. This teacher's own complaints to admins
                { teacher: req.user._id, isTeacherComplaint: true }
            ];
        }
    }
    
    console.log("Query built:", JSON.stringify(query, null, 2)); // Log the query for debugging
    
    try {
        // Populate appropriate fields based on complaint type
        const complaints = await Complaint.find(query)
            .populate({
                path: 'student',
                select: 'name email role studentInfo',
                model: 'User'
            })
            .populate('teacher', 'name email role')
            .populate('assignedTo', 'name email role')
            .populate('assignedTeacher', 'name email role')
            .populate('responses.responder', 'name role')
            .sort('-createdAt');
        
        console.log(`Found ${complaints.length} complaints matching query`); // Debug log
        
        // If we successfully got complaints, enhance student data where needed
        if (complaints && complaints.length > 0) {
            for (let complaint of complaints) {
                // Only try to enhance student data for student complaints
                if (!complaint.isTeacherComplaint && complaint.student && complaint.student._id) {
                    try {
                        // Try to get additional student data from Student model
                        const studentData = await mongoose.model('Student').findOne({ user: complaint.student._id })
                            .select('name class section rollNumber');
                        
                        // If we found additional data, enhance the student object
                        if (studentData) {
                            complaint.student.studentDetails = {
                                class: studentData.class,
                                section: studentData.section,
                                rollNumber: studentData.rollNumber
                            };
                        }
                    } catch (err) {
                        console.log("Could not enhance student data:", err.message);
                    }
                }
            }
            
            console.log("Found complaints:", complaints.length);
            res.status(200).json(complaints);
        } else {
            // If no complaints found, return empty array
            res.status(200).json([]);
        }
    } catch (err) {
        console.error("Failed to get complaints:", err);
        res.status(500).json({ error: "Failed to retrieve complaints" });
    }
});

// Get a single complaint by ID
export const getComplaintById = asyncHandler(async (req, res) => {
    try {
        // Try to populate from User model first
        const complaint = await Complaint.findById(req.params.id)
            .populate({
                path: 'student',
                select: 'name email role studentInfo',
                model: 'User'
            })
            .populate('assignedTo', 'name email role')
            .populate('assignedTeacher', 'name email role')
            .populate('responses.responder', 'name role');
        
        if (!complaint) {
            return res.status(404).json({ error: "Complaint not found" });
        }
        
        // Check access permissions for teachers
        if (req.user.role === 'teacher') {
            const isTeacherComplaint = complaint.isTeacherComplaint === true;
            const isOwnComplaint = isTeacherComplaint && complaint.teacher && 
                                   complaint.teacher.toString() === req.user._id.toString();
            const isAssignedTeacher = complaint.assignedTeacher && 
                                     complaint.assignedTeacher.toString() === req.user._id.toString();
            
            // Teacher can only view: 
            // 1. Their own complaints to admin
            // 2. Student complaints specifically assigned to them
            if (!isOwnComplaint && !isAssignedTeacher) {
                return res.status(403).json({ error: "You do not have permission to view this complaint" });
            }
        }
        
        // Try to enhance with Student model data if possible
        if (complaint.student && complaint.student._id) {
            try {
                const studentData = await mongoose.model('Student').findOne({ user: complaint.student._id })
                    .select('name class section rollNumber');
                
                if (studentData) {
                    complaint.student.studentDetails = {
                        class: studentData.class,
                        section: studentData.section,
                        rollNumber: studentData.rollNumber
                    };
                }
            } catch (err) {
                console.log("Could not enhance student data:", err.message);
            }
        }
        
        res.status(200).json(complaint);
    } catch (err) {
        console.error("Failed to get complaint:", err);
        res.status(500).json({ error: "Failed to retrieve complaint" });
    }
});

// Add a response to a complaint
export const respondToComplaint = asyncHandler(async (req, res) => {
    const { message, status } = req.body;
    const responder = req.user._id;
    
    if (!message) {
        return res.status(400).json({ error: "Please provide a message" });
    }
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
    }
    
    // Check access permissions for teachers
    if (req.user.role === 'teacher') {
        const isTeacherComplaint = complaint.isTeacherComplaint === true;
        const isOwnComplaint = isTeacherComplaint && complaint.teacher && 
                               complaint.teacher.toString() === req.user._id.toString();
        const isAssignedTeacher = complaint.assignedTeacher && 
                                 complaint.assignedTeacher.toString() === req.user._id.toString();
        
        // Teacher cannot respond to:
        // 1. Their own complaints to admin (only admin can respond to these)
        // 2. Complaints not assigned to them
        if (isOwnComplaint || (!isAssignedTeacher && !isOwnComplaint)) {
            return res.status(403).json({ error: "You do not have permission to respond to this complaint" });
        }
    }
    
    // Add response
    const responseData = {
        responder,
        message,
        responseDate: new Date()
    };
    
    // Update status if provided
    if (status) {
        complaint.status = status;
        if (status === 'resolved') {
            complaint.resolvedDate = new Date();
        }
    }
    
    // Add response to the array
    complaint.responses.push(responseData);
    await complaint.save();
    
    // Return updated complaint with populated fields
    const updatedComplaint = await Complaint.findById(req.params.id)
        .populate('student', 'name rollNumber class section')
        .populate({
            path: 'student',
            select: 'name email',
            model: 'User'
        })
        .populate('assignedTo', 'name email role')
        .populate('assignedTeacher', 'name email role')
        .populate('responses.responder', 'name role');
    
    res.status(200).json(updatedComplaint);
});

// Assign complaint to staff
export const assignComplaint = asyncHandler(async (req, res) => {
    const { assignedTo } = req.body;
    
    if (!assignedTo) {
        return res.status(400).json({ error: "Please provide user ID to assign to" });
    }
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
    }
    
    complaint.assignedTo = assignedTo;
    complaint.status = 'in_progress';
    
    await complaint.save();
    
    const updatedComplaint = await Complaint.findById(req.params.id)
        .populate('student', 'name rollNumber class section')
        .populate({
            path: 'student',
            select: 'name email',
            model: 'User'
        })
        .populate('assignedTo', 'name email role')
        .populate('assignedTeacher', 'name email role')
        .populate('responses.responder', 'name role');
    
    res.status(200).json(updatedComplaint);
});

// Update complaint status
export const updateComplaintStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    
    if (!status || !['pending', 'in_progress', 'resolved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Please provide a valid status" });
    }
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
        return res.status(404).json({ error: "Complaint not found" });
    }
    
    // Check access permissions for teachers
    if (req.user.role === 'teacher') {
        const isTeacherComplaint = complaint.isTeacherComplaint === true;
        const isOwnComplaint = isTeacherComplaint && complaint.teacher && 
                               complaint.teacher.toString() === req.user._id.toString();
        const isAssignedTeacher = complaint.assignedTeacher && 
                                 complaint.assignedTeacher.toString() === req.user._id.toString();
        
        // Teacher can only update status of: 
        // 1. Their own complaints to admin
        // 2. Student complaints specifically assigned to them
        if (!isOwnComplaint && !isAssignedTeacher) {
            return res.status(403).json({ error: "You do not have permission to update this complaint" });
        }
    }
    
    complaint.status = status;
    
    // Set resolved date if status is 'resolved'
    if (status === 'resolved') {
        complaint.resolvedDate = new Date();
    }
    
    await complaint.save();
    
    const updatedComplaint = await Complaint.findById(req.params.id)
        .populate('student', 'name rollNumber class section')
        .populate({
            path: 'student',
            select: 'name email',
            model: 'User'
        })
        .populate('assignedTo', 'name email role')
        .populate('assignedTeacher', 'name email role')
        .populate('responses.responder', 'name role');
    
    res.status(200).json(updatedComplaint);
});

// Delete a complaint - teachers and admins only
export const deleteComplaint = asyncHandler(async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        
        if (!complaint) {
            return res.status(404).json({ error: "Complaint not found" });
        }
        
        // Check access permissions for teachers
        if (req.user.role === 'teacher') {
            const isTeacherComplaint = complaint.isTeacherComplaint === true;
            const isOwnComplaint = isTeacherComplaint && complaint.teacher && 
                                   complaint.teacher.toString() === req.user._id.toString();
            const isAssignedTeacher = complaint.assignedTeacher && 
                                     complaint.assignedTeacher.toString() === req.user._id.toString();
            
            // Teacher can only delete: 
            // 1. Their own complaints to admin
            // 2. Student complaints specifically assigned to them
            if (!isOwnComplaint && !isAssignedTeacher) {
                return res.status(403).json({ error: "You do not have permission to delete this complaint" });
            }
        }
        
        await Complaint.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Complaint deleted successfully" });
    } catch (err) {
        console.error("Failed to delete complaint:", err);
        res.status(500).json({ error: "Failed to delete complaint" });
    }
});

// Function for teachers to submit complaints to admins
export const addTeacherComplaint = asyncHandler(async (req, res) => {
    try {
        const teacher_id = req.user._id;
        const { subject, description, category, priority } = req.body;
        
        if (!subject || !description) {
            return res.status(400).json({ 
                error: "Please provide subject and description" 
            });
        }
        
        // Create a new complaint from teacher to admin
        const complaint = new Complaint({
            teacher: teacher_id,     // Store teacher ID as the originator
            subject,
            description,
            category: category || 'other',
            priority: priority || 'medium',
            isTeacherComplaint: true, // Flag to identify teacher complaints
            status: 'pending'
        });
        
        await complaint.save();
        
        res.status(201).json({
            success: true,
            message: "Complaint submitted successfully",
            complaint
        });
    } catch (error) {
        console.error("Error submitting teacher complaint:", error);
        res.status(500).json({ 
            error: "Failed to submit complaint",
            details: error.message
        });
    }
});