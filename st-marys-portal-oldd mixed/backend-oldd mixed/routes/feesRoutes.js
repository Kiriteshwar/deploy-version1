import express from 'express';
const router = express.Router();
import { getFees, payFees, logReceiptAction } from '../controllers/feesController.js';
import { searchStudents, getStudentFees, makePayment, updateDiscount, searchPayments, updateFeeStructure, updatePaymentBalance } from '../controllers/adminController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

router.get('/test', (req, res) => {
  res.json({ message: 'Fees route is working' });
});

// Student fee routes
router.get('/', protect, getFees);
router.post('/pay', protect, payFees);
router.post('/receipt-log', protect, logReceiptAction);

// Admin fee management routes
router.get('/admin/students', protect, adminOnly, searchStudents);
router.get('/admin/student/:studentId', protect, adminOnly, getStudentFees);
router.post('/admin/pay/:studentId', protect, adminOnly, makePayment);
router.put('/admin/discount/:studentId', protect, adminOnly, updateDiscount);
router.get('/admin/search', protect, adminOnly, searchPayments);
router.put('/admin/structure/:id', protect, adminOnly, updateFeeStructure);
router.put('/admin/payment-balance/:paymentId', protect, adminOnly, updatePaymentBalance);

export default router;

