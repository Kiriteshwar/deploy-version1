console.log('feesController.js loaded');
import { FeePayment, FeeStructure } from '../models/feesModel.js';
// import Student from '../models/studentModel.js';
import asyncHandler from 'express-async-handler';

// Get student's fee details
export const getFees = asyncHandler(async (req, res) => {
    console.log('req.user:', req.user);
    console.log('getFees called for user:', req.user._id);
    const studentInfo = req.user.studentInfo;
    console.log('Student info from user:', studentInfo);
    if (!studentInfo) {
        return res.status(404).json({ error: 'Student info not found on user' });
    }

    const currentYear = new Date().getFullYear().toString();
    
    try {
        // Use centralized calculation method
        const feeData = await FeePayment.calculateFeeTotals(req.user._id, currentYear);
        
        // Save the payment record if it's new or modified
        if (feeData.paymentRecord.isNew || feeData.paymentRecord.isModified()) {
            await feeData.paymentRecord.save();
        }

        // Get all payment records for history
        const allRecords = await FeePayment.find({ 
            student: req.user._id,
            academicYear: currentYear
        }).populate('feeStructure').sort('-createdAt');

        res.json({
            student: {
                name: req.user.name,
                class: studentInfo.class,
                section: studentInfo.section,
                rollNumber: studentInfo.rollNumber
            },
            feeStructure: feeData.feeStructure,
            payments: allRecords
        });
    } catch (error) {
        console.error('Error calculating fee totals:', error);
        res.status(500).json({ error: error.message });
    }
});

// Make a fee payment
export const payFees = asyncHandler(async (req, res) => {
    const studentInfo = req.user.studentInfo;
    if (!studentInfo) {
        return res.status(404).json({ error: 'Student info not found on user' });
    }
    const { amount, paymentMode, transactionId } = req.body;
    // Validate payment amount
    const feeStructure = await FeeStructure.getFeeStructure(studentInfo.class, studentInfo.academicYear || new Date().getFullYear().toString());
    if (!feeStructure) {
        return res.status(404).json({ error: 'Fee structure not found for this class' });
    }

    // Calculate total to be paid (fee structure total minus student discount)
    const totalToBePaid = feeStructure.totalFee - (req.user.discount || 0);

    const paymentData = {
        student: req.user._id,
        academicYear: studentInfo.academicYear || new Date().getFullYear().toString(),
        class: studentInfo.class,
        section: studentInfo.section,
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

// Get fee payment history
export const getPaymentHistory = asyncHandler(async (req, res) => {
    const studentInfo = req.user.studentInfo;
    if (!studentInfo) {
        return res.status(404).json({ error: 'Student info not found on user' });
    }
    const { startDate, endDate } = req.query;
    const payments = await FeePayment.find({
        student: req.user._id,
        'payments.paymentDate': {
            $gte: startDate ? new Date(startDate) : new Date(0),
            $lte: endDate ? new Date(endDate) : new Date()
        }
    }).sort('-payments.paymentDate');
    res.json(payments);
});

// Get fee receipt
export const getFeeReceipt = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const studentInfo = req.user.studentInfo;
    if (!studentInfo) {
        return res.status(404).json({ error: 'Student info not found on user' });
    }
    const payment = await FeePayment.findOne({
        _id: paymentId,
        student: req.user._id
    }).populate('feeStructure');
    if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
    }
    const receipt = payment.payments.find(p => p.receipt && p.receipt.number);
    if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' });
    }
    res.json({
        receiptNumber: receipt.receipt.number,
        studentName: req.user.name,
        class: studentInfo.class,
        section: studentInfo.section,
        rollNumber: studentInfo.rollNumber,
        amount: receipt.amount,
        paymentDate: receipt.paymentDate,
        paymentMode: receipt.paymentMode,
        transactionId: receipt.transactionId,
        feeStructure: payment.feeStructure
    });
});

// Log receipt view/download
export const logReceiptAction = asyncHandler(async (req, res) => {
    const { paymentId, paymentIndex, action } = req.body;
    if (!['view', 'download'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }
    const paymentDoc = await FeePayment.findById(paymentId);
    if (!paymentDoc) {
        return res.status(404).json({ error: 'Payment record not found' });
    }
    if (!paymentDoc.payments[paymentIndex] || !paymentDoc.payments[paymentIndex].receipt) {
        return res.status(404).json({ error: 'Receipt not found for this payment' });
    }
    if (!paymentDoc.payments[paymentIndex].receipt.logs) {
        paymentDoc.payments[paymentIndex].receipt.logs = [];
    }
    paymentDoc.payments[paymentIndex].receipt.logs.push({ action, at: new Date() });
    await paymentDoc.save();
    res.json({ success: true });
});
