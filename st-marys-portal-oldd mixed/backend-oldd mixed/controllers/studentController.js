// // controllers/studentController.js
// import bcrypt from 'bcrypt';
// import jwt from 'jsonwebtoken';
// // import studentModel from '../models/studentModel.js';
// import { createStudent, getStudentByEmail, getStudentById } from "../models/studentModel.js";  // ✅ Use named imports
// import { JWT_SECRET } from '../config/auth.js';

// const registerStudent = async (req, res) => {
//   try {
//     const { name, email, password, phone, address } = req.body;
//     const existing = await studentModel.getStudentByEmail(email);
//     if (existing) return res.status(400).json({ message: 'Email already registered' });

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const student = await studentModel.createStudent({ name, email, password: hashedPassword, phone, address });
//     res.status(201).json({ message: 'Student registered', student });
//   } catch (err) {
//     res.status(500).json({ message: 'Registration failed', error: err.message });
//   }
// };

// const loginStudent = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     console.log("Login request received with email:", email);

//     const student = await studentModel.getStudentByEmail(email);
//     if (!student) {
//       console.log("Student not found with email:", email);
//       return res.status(401).json({ message: 'Invalid email or password' });
//     }

//     console.log("Student found:", student.email);
//     console.log("Comparing passwords:", password, student.password);

//     const valid = await bcrypt.compare(password, student.password);
//     if (!valid) {
//       console.log("Incorrect password for student with email:", student.email);
//       return res.status(401).json({ message: 'Invalid email or password' });
//     }

//     // const token = jwt.sign({ id: student.id, email: student.email }, JWT_SECRET, { expiresIn: "60s" });
//     // res.json({ message: 'Login successful', token });
//     const token = jwt.sign({ id: student.id, email: student.email }, JWT_SECRET, { expiresIn: "2h" });

//     res.json({ 
//         message: 'Login successful', 
//         token, 
//         expiresAt: new Date(Date.now() + 60 * 1000).toISOString() // ✅ Sends expiration timestamp
//     });

//   } catch (err) {
//     console.error("❌ Error during loginStudent:", err);
//     res.status(500).json({ message: 'Login failed', error: err.message });
//   }
// };

// module.exports = {
//   registerStudent,
//   loginStudent,
// };


//////esmm
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";

export async function registerStudent(req, res) {
    try {
        const { name, email, password, phone, address, class: className, section, rollNumber, guardianName, guardianPhone } = req.body;
        
        // Check if student already exists
        const existingStudent = await Student.findOne({ email });
        if (existingStudent) {
            return res.status(400).json({ message: "Email already registered" });
        }

        // Create user account first
        const user = await User.create({
            name,
            email,
            password, // Password will be hashed by User model pre-save hook
            phone,
            role: 'student'
        });

        // Create student profile
        const student = await Student.create({
            user: user._id,
            name,
            email,
            phone,
            address,
            class: className,
            section,
            rollNumber,
            guardianName,
            guardianPhone
        });

        const token = jwt.sign(
            { id: user._id, role: 'student' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(201).json({
            message: "Student registered successfully",
            student: {
                id: student._id,
                name: student.name,
                email: student.email,
                class: student.class,
                section: student.section,
                rollNumber: student.rollNumber
            },
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Registration failed", error: error.message });
    }
}

export async function loginStudent(req, res) {
    try {
        const { email, password } = req.body;
        console.log("Login request received with email:", email);

        const student = await Student.findOne({ email }).select('+password');
        if (!student) {
            console.log("Student not found with email:", email);
            return res.status(401).json({ message: "Invalid email or password" });
        }

        console.log("Student found:", student.email);

        const isMatch = await student.matchPassword(password);
        if (!isMatch) {
            console.log("Incorrect password for student with email:", student.email);
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign(
            { id: student._id, role: 'student' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: "Login successful",
            student: {
                id: student._id,
                name: student.name,
                email: student.email,
                class: student.class,
                section: student.section,
                rollNumber: student.rollNumber
            },
            token,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

    } catch (error) {
        console.error("❌ Error during loginStudent:", error);
        res.status(500).json({ message: "Login failed", error: error.message });
    }
}