// // models/teacherModel.js
// import pool from '../config/db.js';

// const createTeacher = async (teacher) => {
//   const { name, email, password, phone } = teacher;
//   const result = await pool.query(
//     'INSERT INTO teachers (name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING *',
//     [name, email, password, phone]
//   );
//   return result.rows[0];
// };

// const getTeacherByEmail = async (email) => {
//   const result = await pool.query('SELECT * FROM teachers WHERE email = $1', [email]);
//   return result.rows[0];
// };

// const getTeacherById = async (id) => {
//   const result = await pool.query('SELECT * FROM teachers WHERE id = $1', [id]);
//   return result.rows[0];
// };

// module.exports = {
//   createTeacher,
//   getTeacherByEmail,
//   getTeacherById,
// };

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const teacherSchema = new mongoose.Schema({
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
    subject: {
        type: String,
        required: true
    },
    qualifications: [{
        degree: String,
        institution: String,
        year: Number
    }],
    classes: [{
        grade: String,
        section: String
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Hash password before saving
teacherSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
teacherSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const Teacher = mongoose.model('Teacher', teacherSchema);

export default Teacher;

