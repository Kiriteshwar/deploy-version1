// models/studentModel.js
// import pool from '../config/db.js';

// const createStudent = async (student) => {
//   const { name, email, password, phone, address } = student;
//   const result = await pool.query(
//     'INSERT INTO students (name, email, password, phone, address) VALUES ($1, $2, $3, $4, $5) RETURNING *',
//     [name, email, password, phone, address]
//   );
//   return result.rows[0];
// };

// const getStudentByEmail = async (email) => {
//   const result = await pool.query('SELECT * FROM students WHERE email = $1', [email]);
//   return result.rows[0];
// };

// const getStudentById = async (id) => {
//   const result = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
//   return result.rows[0];
// };

// module.exports = {
//   createStudent,
//   getStudentByEmail,
//   getStudentById,
// };

import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    class: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    rollNumber: {
        type: String,
        required: true,
        unique: true
    },
    dateOfBirth: Date,
    gender: String,
    address: String,
    guardianName: String,
    guardianPhone: String,
    bloodGroup: String,
    academicYear: {
        type: String,
        default: () => new Date().getFullYear().toString()
    },
    admissionDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create index for faster queries
studentSchema.index({ class: 1, section: 1 });
studentSchema.index({ user: 1 });
studentSchema.index({ rollNumber: 1 });

// Static method to get all students in a class/section
studentSchema.statics.getStudentsByClass = async function(className, section) {
    return this.find({ class: className, section })
        .sort('rollNumber')
        .populate('user', 'name email profilePhoto'); 
};

// Static method to get a student by user ID
studentSchema.statics.getStudentByUser = async function(userId) {
    return this.findOne({ user: userId })
        .populate('user', 'name email profilePhoto');
};

const Student = mongoose.model('Student', studentSchema);

export default Student;