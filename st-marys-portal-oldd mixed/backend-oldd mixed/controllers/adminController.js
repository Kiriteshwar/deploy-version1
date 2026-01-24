import asyncHandler from 'express-async-handler';
import Timetable from '../models/timetableModel.js';
import TeacherAvailability from '../models/teacherAvailabilityModel.js';
import User from '../models/userModel.js';
import { FeePayment, FeeStructure } from '../models/feesModel.js';
import bcrypt from 'bcryptjs';

// @desc    Get all timetable entries
// @route   GET /api/admin/timetable
// @access  Private (Admin only)
export const getTimetable = asyncHandler(async (req, res) => {
    const { class: className, section, dayOfWeek } = req.query;

    const query = {};
    if (className) query.class = className;
    if (section) query.section = section;
    if (dayOfWeek) query.dayOfWeek = parseInt(dayOfWeek);

    const timetable = await Timetable.find(query)
        .populate('assignedTeacher', 'name email subjects')
        .populate('allowedSubstitutes.teacher', 'name email subjects')
        .sort({ dayOfWeek: 1, period: 1 });

    res.json(timetable);
});

// @desc    Get available teachers for substitution
// @route   GET /api/admin/available-teachers
// @access  Private (Admin only)
export const getAvailableTeachers = asyncHandler(async (req, res) => {
    const { date, period, subject } = req.query;

    if (!date || !period) {
        res.status(400);
        throw new Error('Date and period are required');
    }

    // Find teachers who are available and don't have a class in this period
    const busyTeachers = await Timetable.find({
        dayOfWeek: new Date(date).getDay(),
        period: parseInt(period)
    }).distinct('assignedTeacher');

    const unavailableTeachers = await TeacherAvailability.find({
        date: new Date(date),
        availabilityStatus: { $ne: 'available' }
    }).distinct('teacher');

    // Find all teachers except those who are busy or unavailable
    const availableTeachers = await User.find({
        role: 'teacher',
        _id: {
            $nin: [...busyTeachers, ...unavailableTeachers]
        }
    }).select('name email teacherInfo');

    // If subject is specified, prioritize teachers who teach that subject
    if (subject) {
        availableTeachers.sort((a, b) => {
            const aTeachesSubject = a.teacherInfo.subjects.includes(subject);
            const bTeachesSubject = b.teacherInfo.subjects.includes(subject);
            return bTeachesSubject - aTeachesSubject;
        });
    }

    res.json(availableTeachers);
});

// @desc    Assign substitute teacher
// @route   POST /api/admin/assign-substitute
// @access  Private (Admin only)
export const assignSubstitute = asyncHandler(async (req, res) => {
    const {
        date,
        period,
        class: className,
        section,
        substituteTeacherId,
        reason
    } = req.body;

    if (!date || !period || !className || !section || !substituteTeacherId) {
        res.status(400);
        throw new Error('All fields are required');
    }

    // Find the original timetable entry
    const timetableEntry = await Timetable.findOne({
        class: className,
        section,
        dayOfWeek: new Date(date).getDay(),
        period: parseInt(period)
    }).populate('assignedTeacher');

    if (!timetableEntry) {
        res.status(404);
        throw new Error('Timetable entry not found');
    }

    // Check if substitute teacher is available
    const isAvailable = await TeacherAvailability.isTeacherAvailable(
        substituteTeacherId,
        date,
        period
    );

    if (!isAvailable) {
        res.status(400);
        throw new Error('Selected teacher is not available for substitution');
    }

    // Update teacher availability for both original and substitute teacher
    await TeacherAvailability.updateAvailability(
        timetableEntry.assignedTeacher._id,
        date,
        period,
        'unavailable',
        reason
    );

    await TeacherAvailability.updateAvailability(
        substituteTeacherId,
        date,
        period,
        'substitute',
        `Substituting for ${timetableEntry.assignedTeacher.name}`
    );

    // Add substitute teacher to allowed substitutes if not already present
    if (!timetableEntry.allowedSubstitutes.some(s => s.teacher.equals(substituteTeacherId))) {
        timetableEntry.allowedSubstitutes.push({
            teacher: substituteTeacherId,
            priority: 1
        });
        await timetableEntry.save();
    }

    res.json({
        message: 'Substitute teacher assigned successfully',
        timetableEntry
    });
});

// @desc    Get teacher availability status
// @route   GET /api/admin/teacher-availability
// @access  Private (Admin only)
export const getTeacherAvailability = asyncHandler(async (req, res) => {
    const { date } = req.query;

    if (!date) {
        res.status(400);
        throw new Error('Date is required');
    }

    const availability = await TeacherAvailability.find({
        date: new Date(date)
    }).populate('teacher', 'name email');

    res.json(availability);
});

// @desc    Search students for fee management
// @route   GET /api/admin/fees/students
// @access  Private (Admin only)
export const searchStudents = asyncHandler(async (req, res) => {
    const { class: className, section, search } = req.query;

    const query = { role: 'student' };
    if (className) query['studentInfo.class'] = className;
    if (section) query['studentInfo.section'] = section;

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { 'studentInfo.rollNumber': { $regex: search, $options: 'i' } }
        ];
    }

    const students = await User.find(query)
        .select('name studentInfo discount')
        .sort('studentInfo.rollNumber');

    res.json(students);
});

// @desc    Get student's fee details (for admin)
// @route   GET /api/admin/fees/student/:studentId
// @access  Private (Admin only)
export const getStudentFees = asyncHandler(async (req, res) => {
    const student = await User.findById(req.params.studentId).select('+discount');
    if (!student || student.role !== 'student') {
        return res.status(404).json({ error: 'Student not found or is not a student' });
    }

    const currentYear = new Date().getFullYear().toString();

    try {
        // Use centralized calculation method
        const feeData = await FeePayment.calculateFeeTotals(student._id, currentYear);

        // Save the payment record if it's new or modified
        if (feeData.paymentRecord.isNew || feeData.paymentRecord.isModified()) {
            await feeData.paymentRecord.save();
        }

        // Get all payment records for history
        const allRecords = await FeePayment.find({
            student: student._id,
            academicYear: currentYear
        }).populate('feeStructure').sort('-createdAt');

        const studentData = {
            _id: student._id,
            name: student.name,
            class: student.studentInfo.class,
            section: student.studentInfo.section,
            rollNumber: student.studentInfo.rollNumber,
            guardianName: student.studentInfo.guardianName,
            guardianPhone: student.studentInfo.guardianPhone,
            address: student.studentInfo.address,
            discount: student.discount || 0
        };

        res.json({
            student: studentData,
            feeStructure: feeData.feeStructure,
            payments: allRecords
        });
    } catch (error) {
        console.error('Error calculating fee totals:', error);
        res.status(500).json({ error: error.message });
    }
});

// @desc    Make fee payment (by admin)
// @route   POST /api/admin/fees/pay/:studentId
// @access  Private (Admin only)
export const makePayment = asyncHandler(async (req, res) => {
    const student = await User.findById(req.params.studentId);
    if (!student || student.role !== 'student') {
        return res.status(404).json({ error: 'Student not found' });
    }

    const { amount, paymentMode, transactionId } = req.body;
    const currentYear = new Date().getFullYear().toString();

    const feeStructure = await FeeStructure.getFeeStructure(student.studentInfo.class, currentYear);
    if (!feeStructure) {
        return res.status(404).json({ error: 'Fee structure not found' });
    }

    // Calculate total to be paid (fee structure total minus student discount)
    const totalToBePaid = feeStructure.totalFee - (student.discount || 0);

    const paymentData = {
        student: student._id,
        academicYear: currentYear,
        class: student.studentInfo.class,
        section: student.studentInfo.section,
        feeStructure: feeStructure._id,
        totalToBePaid: totalToBePaid,
        payment: {
            amount,
            paymentMode,
            transactionId,
            receivedBy: req.user._id,
            receipt: {
                number: `RCP${Date.now()}`,
                generatedAt: new Date()
            }
        },
        dueDate: feeStructure.dueDate || new Date(new Date().setDate(new Date().getDate() + 15))
    };

    const payment = await FeePayment.addPayment(paymentData);
    res.status(201).json(payment);
});

// @desc    Update student's discount
// @route   PUT /api/admin/fees/discount/:studentId
// @access  Private (Admin only)
export const updateDiscount = asyncHandler(async (req, res) => {
    const { discount } = req.body;

    // Validate discount amount
    if (discount < 0) {
        return res.status(400).json({ error: 'Discount amount cannot be negative' });
    }

    // Find student and validate role
    const student = await User.findById(req.params.studentId);
    if (!student) {
        return res.status(404).json({ error: 'Student not found' });
    }
    if (student.role !== 'student') {
        return res.status(400).json({ error: 'Discount can only be applied to students' });
    }

    // Get fee structure to validate discount
    const currentYear = new Date().getFullYear().toString();
    const feeStructure = await FeeStructure.getFeeStructure(student.studentInfo.class, currentYear);

    if (!feeStructure) {
        return res.status(404).json({ error: 'Fee structure not found' });
    }

    // Validate discount doesn't exceed total fee
    if (discount > feeStructure.totalFee) {
        return res.status(400).json({
            error: `Discount amount (₹${discount}) cannot exceed total fee (₹${feeStructure.totalFee})`
        });
    }

    // Update discount
    student.discount = discount;
    await student.save();

    // Calculate updated totals
    const totalFee = feeStructure.totalFee;
    const discountedFee = totalFee - discount;

    // Get payment records to calculate balance
    const payments = await FeePayment.find({ student: student._id })
        .sort('-createdAt')
        .limit(1);

    const totalPaid = payments.length > 0 ? payments[0].totalPaid : 0;
    const balance = discountedFee - totalPaid;

    // Update fee payment record if it exists
    if (payments.length > 0) {
        payments[0].totalToBePaid = discountedFee;
        payments[0].balance = balance;
        await payments[0].save();
    }

    res.json({
        student: {
            _id: student._id,
            name: student.name,
            class: student.studentInfo.class,
            section: student.studentInfo.section,
            rollNumber: student.studentInfo.rollNumber,
            guardianName: student.studentInfo.guardianName,
            guardianPhone: student.studentInfo.guardianPhone,
            address: student.studentInfo.address,
            discount: student.discount
        },
        feeStructure,
        payments
    });
});

// @desc    Search fee payments
// @route   GET /api/admin/fees/search
// @access  Private (Admin only)
export const searchPayments = asyncHandler(async (req, res) => {
    const { search, startDate, endDate, class: className, section } = req.query;

    const query = {};

    if (className) query.class = className;
    if (section) query.section = section;

    if (startDate || endDate) {
        query['payments.paymentDate'] = {};
        if (startDate) query['payments.paymentDate'].$gte = new Date(startDate);
        if (endDate) query['payments.paymentDate'].$lte = new Date(endDate);
    }

    if (search) {
        query.$or = [
            { 'payments.transactionId': { $regex: search, $options: 'i' } },
            { 'payments.receipt.number': { $regex: search, $options: 'i' } }
        ];

        // Also search in student details
        const students = await User.find({
            role: 'student',
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { 'studentInfo.rollNumber': { $regex: search, $options: 'i' } }
            ]
        }).select('_id');

        if (students.length > 0) {
            query.$or.push({ student: { $in: students.map(s => s._id) } });
        }
    }

    const payments = await FeePayment.find(query)
        .populate('student', 'name studentInfo')
        .populate('feeStructure')
        .sort('-payments.paymentDate');

    res.json(payments);
});

// @desc    Update fee structure
// @route   PUT /api/admin/fees/structure/:id
// @access  Private (Admin only)
export const updateFeeStructure = asyncHandler(async (req, res) => {
    const {
        tuitionFee,
        libraryFee,
        laboratoryFee,
        transportFee,
        computerFee,
        examFee
    } = req.body;

    const feeStructure = await FeeStructure.findById(req.params.id);
    if (!feeStructure) {
        return res.status(404).json({ error: 'Fee structure not found' });
    }

    // Update fee components
    if (typeof tuitionFee === 'number') feeStructure.tuitionFee = tuitionFee;
    if (typeof libraryFee === 'number') feeStructure.libraryFee = libraryFee;
    if (typeof laboratoryFee === 'number') feeStructure.laboratoryFee = laboratoryFee;
    if (typeof transportFee === 'number') feeStructure.transportFee = transportFee;
    if (typeof computerFee === 'number') feeStructure.computerFee = computerFee;
    if (typeof examFee === 'number') feeStructure.examFee = examFee;

    // Save will trigger the pre-save middleware that recalculates totalFee
    const updatedFeeStructure = await feeStructure.save();
    res.json(updatedFeeStructure);
});

// @desc    Update payment balance and totalToBePaid
// @route   PUT /api/admin/fees/payment-balance/:paymentId
// @access  Private (Admin only)
export const updatePaymentBalance = asyncHandler(async (req, res) => {
    const { balance, totalToBePaid } = req.body;

    if (typeof balance !== 'number' || typeof totalToBePaid !== 'number') {
        return res.status(400).json({ error: 'Invalid balance or totalToBePaid amount' });
    }

    const payment = await FeePayment.findById(req.params.paymentId);

    if (!payment) {
        return res.status(404).json({ error: 'Payment record not found' });
    }

    // Update fields
    payment.balance = balance;
    payment.totalToBePaid = totalToBePaid;

    // The pre-save middleware will handle status based on the new balance
    await payment.save();

    res.json({
        message: 'Payment balance updated successfully',
        balance: payment.balance,
        totalToBePaid: payment.totalToBePaid,
        status: payment.status // Return updated status
    });
});

// --- USER MANAGEMENT ENDPOINTS ---

// @desc    Get users by role
// @route   GET /api/admin/users?role=student|teacher|admin&class=X&section=Y&search=name
// @access  Private (Admin only)
export const getUsers = asyncHandler(async (req, res) => {
    const { role, class: className, section, search } = req.query;
    const query = {};

    if (role) query.role = role;

    // Add filters for students
    if (role === 'student') {
        if (className) query['studentInfo.class'] = className;
        if (section) query['studentInfo.section'] = section;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { 'studentInfo.rollNumber': { $regex: search, $options: 'i' } }
            ];
        }
    }

    // Add search for teachers and admins
    if ((role === 'teacher' || role === 'admin') && search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }

    const users = await User.find(query).sort({ name: 1 });
    res.json({ success: true, users });
});

// @desc    Add a new user
// @route   POST /api/admin/users
// @access  Private (Admin only)
export const addUser = asyncHandler(async (req, res) => {
    const { name, email, phone, password, role, studentInfo, teacherInfo, adminInfo } = req.body;
    if (!name || !email || !phone || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing required fields: name, email, phone, password, role' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, phone, password: hashedPassword, role });
    if (role === 'student' && studentInfo) user.studentInfo = studentInfo;
    if (role === 'teacher' && teacherInfo) user.teacherInfo = teacherInfo;
    if (role === 'admin' && adminInfo) user.adminInfo = adminInfo;
    await user.save();
    res.json({ success: true, user });
});

// @desc    Update a user
// @route   PUT /api/admin/users/:id
// @access  Private (Admin only)
export const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, email, password, studentInfo, teacherInfo, phone } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password = await bcrypt.hash(password, 10);

    // Handle studentInfo updates - preserve existing fields
    if (user.role === 'student' && studentInfo) {
        // Merge with existing studentInfo to preserve all fields
        user.studentInfo = {
            ...user.studentInfo,  // Keep existing fields
            ...studentInfo        // Update with new fields
        };
        console.log(`Updated studentInfo for ${user.name}:`, user.studentInfo);
    }

    // Handle teacherInfo updates - preserve existing fields  
    if (user.role === 'teacher' && teacherInfo) {
        user.teacherInfo = {
            ...user.teacherInfo,  // Keep existing fields
            ...teacherInfo        // Update with new fields
        };
    }

    // Handle phone updates with sync for students
    if (phone) {
        user.phone = phone;

        // For students, also update fatherGuardianPhone to keep them in sync
        if (user.role === 'student' && user.studentInfo) {
            user.studentInfo.fatherGuardianPhone = phone;
            console.log(`Syncing fatherGuardianPhone for student ${user.name}: ${phone}`);
        }
    }

    await user.save();
    res.json({ success: true, user });
});

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
export const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true });
});

// @desc    Bulk import users from array
// @route   POST /api/admin/users/bulk
// @access  Private (Admin only)
export const bulkImportUsers = asyncHandler(async (req, res) => {
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ success: false, message: 'No users data provided' });
    }

    const results = { success: 0, failed: 0, errors: [] };
    const bcrypt = (await import('bcryptjs')).default;

    for (let i = 0; i < users.length; i++) {
        const row = users[i];
        try {
            // Validate required fields
            if (!row.name || !row.email || !row.phone || !row.password || !row.role) {
                results.failed++;
                results.errors.push({ row: i + 2, error: 'Missing required fields (name, email, phone, password, role)' });
                continue;
            }

            // Check if email already exists
            const existingUser = await User.findOne({ email: row.email.toLowerCase() });
            if (existingUser) {
                results.failed++;
                results.errors.push({ row: i + 2, error: `Email ${row.email} already exists` });
                continue;
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(row.password, 10);

            const userData = {
                name: row.name,
                email: row.email.toLowerCase(),
                phone: row.phone,
                password: hashedPassword,
                role: row.role.toLowerCase()
            };

            // Handle student info
            if (userData.role === 'student') {
                if (!row.class || !row.section || !row.rollNumber) {
                    results.failed++;
                    results.errors.push({ row: i + 2, error: 'Students require class, section, and rollNumber' });
                    continue;
                }
                userData.studentInfo = {
                    class: row.class,
                    section: row.section,
                    rollNumber: row.rollNumber,
                    guardianName: row.guardianName || '',
                    fatherGuardianPhone: row.fatherGuardianPhone || row.phone,
                    motherName: row.motherName || '',
                    motherPhone: row.motherPhone || '',
                    address: row.address || '',
                    dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
                    religion: row.religion || '',
                    caste: row.caste || '',
                    subCaste: row.subCaste || '',
                    identificationMark1: row.identificationMark1 || '',
                    identificationMark2: row.identificationMark2 || ''
                };
            }

            // Handle teacher info
            if (userData.role === 'teacher') {
                userData.teacherInfo = {
                    subjects: row.subjects ? row.subjects.split(',').map(s => s.trim()) : [],
                    salary: parseInt(row.salary) || 0,
                    classTeacher: {
                        class: row.classTeacherClass || '',
                        section: row.classTeacherSection || ''
                    }
                };
            }

            // Handle admin info
            if (userData.role === 'admin') {
                userData.adminInfo = {
                    designation: row.designation || ''
                };
            }

            await User.create(userData);
            results.success++;
        } catch (error) {
            results.failed++;
            results.errors.push({ row: i + 2, error: error.message });
        }
    }

    res.json({
        success: true,
        message: `Imported ${results.success} users, ${results.failed} failed`,
        results
    });
});

// @desc    Get fee analytics for dashboard
// @route   GET /api/admin/fee-analytics
// @access  Private (Admin only)
export const getFeeAnalytics = asyncHandler(async (req, res) => {
    const { period, class: className, section } = req.query;

    // Calculate date range based on period
    let startDate = null;
    const now = new Date();

    switch (period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            startDate = null; // All time
    }

    try {
        // Get ALL fee structures (all years)
        const feeStructures = await FeeStructure.find({});

        // Create a map of class -> totalFee (use latest fee structure per class)
        const feeStructureMap = {};
        feeStructures.forEach(fs => {
            // If multiple years exist, use the one with higher totalFee or latest
            if (!feeStructureMap[fs.class] || fs.totalFee > feeStructureMap[fs.class].totalFee) {
                feeStructureMap[fs.class] = fs;
            }
        });

        // Build query for students
        const studentQuery = { role: 'student' };
        if (className) studentQuery['studentInfo.class'] = className;
        if (section) studentQuery['studentInfo.section'] = section;

        // Get all students with their discounts
        const students = await User.find(studentQuery).select('studentInfo discount');

        // Build query for fee payments (ALL years)
        const paymentQuery = {};
        if (className) paymentQuery.class = className;
        if (section) paymentQuery.section = section;

        // Get ALL fee payments (all years)
        const feePayments = await FeePayment.find(paymentQuery);

        // Calculate totals
        let totalExpected = 0;  // Sum of (students × their class fee structure)
        let totalToBePaid = 0;  // After discounts
        let totalCollected = 0; // All time collected
        let periodCollected = 0; // Collected in selected period
        let totalDiscounts = 0;  // Total discounts given

        // Calculate expected and discounts per student
        const classBreakdown = {};

        students.forEach(student => {
            const cls = student.studentInfo?.class;
            const sec = student.studentInfo?.section || '-';

            if (!cls) return;

            const feeStructure = feeStructureMap[cls];
            if (!feeStructure) return;

            const structureFee = feeStructure.totalFee || 0;
            const discount = student.discount || 0;
            const toBePaid = structureFee - discount;

            totalExpected += structureFee;
            totalToBePaid += toBePaid;
            totalDiscounts += discount;

            // Add to class breakdown
            const key = `${cls}-${sec}`;
            if (!classBreakdown[key]) {
                classBreakdown[key] = {
                    class: cls,
                    section: sec,
                    studentCount: 0,
                    totalExpected: 0,
                    totalToBePaid: 0,
                    totalCollected: 0,
                    periodCollected: 0,
                    balance: 0,
                    discounts: 0
                };
            }
            classBreakdown[key].studentCount += 1;
            classBreakdown[key].totalExpected += structureFee;
            classBreakdown[key].totalToBePaid += toBePaid;
            classBreakdown[key].discounts += discount;
        });

        // Process payments to calculate collected amounts
        feePayments.forEach(payment => {
            const cls = payment.class;
            const sec = payment.section || '-';
            const key = `${cls}-${sec}`;

            // Add to total collected (all time)
            const paidAmount = payment.totalPaid || 0;
            totalCollected += paidAmount;

            if (classBreakdown[key]) {
                classBreakdown[key].totalCollected += paidAmount;
            }

            // Calculate period-specific collection from individual payments
            if (payment.payments && payment.payments.length > 0) {
                payment.payments.forEach(p => {
                    if (startDate) {
                        // If there's a period filter, only count payments within that period
                        if (p.paymentDate && new Date(p.paymentDate) >= startDate) {
                            periodCollected += p.amount || 0;
                            if (classBreakdown[key]) {
                                classBreakdown[key].periodCollected += p.amount || 0;
                            }
                        }
                    } else {
                        // All time - add all payments
                        periodCollected += p.amount || 0;
                        if (classBreakdown[key]) {
                            classBreakdown[key].periodCollected += p.amount || 0;
                        }
                    }
                });
            }
        });

        // Calculate balances
        const totalBalance = totalToBePaid - totalCollected;

        Object.values(classBreakdown).forEach(row => {
            row.balance = row.totalToBePaid - row.totalCollected;
        });

        // Convert breakdown to array and sort by class
        const breakdownArray = Object.values(classBreakdown).sort((a, b) => {
            if (a.class === b.class) return a.section.localeCompare(b.section);
            return a.class.localeCompare(b.class);
        });

        // Get unique classes and sections from students (not fee structures)
        const availableClasses = [...new Set(students.map(s => s.studentInfo?.class).filter(Boolean))].sort();
        const availableSections = [...new Set(students.map(s => s.studentInfo?.section).filter(Boolean))].sort();

        res.json({
            success: true,
            summary: {
                totalExpected,
                totalToBePaid,
                totalCollected,
                periodCollected,
                totalBalance,
                totalDiscounts,
                period: period || 'all'
            },
            breakdown: breakdownArray,
            availableClasses,
            availableSections,
            filters: {
                class: className || null,
                section: section || null,
                period: period || 'all'
            }
        });
    } catch (error) {
        console.error('Error fetching fee analytics:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}); 