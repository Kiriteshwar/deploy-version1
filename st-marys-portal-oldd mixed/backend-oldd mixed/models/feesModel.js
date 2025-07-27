import mongoose from 'mongoose';

// Fee Structure Schema
const feeStructureSchema = new mongoose.Schema({
    class: {
        type: String,
        required: true
    },
    academicYear: {
        type: String,
        required: true
    },
    tuitionFee: {
        type: Number,
        required: true
    },
    libraryFee: {
        type: Number,
        required: true
    },
    laboratoryFee: {
        type: Number,
        required: true
    },
    transportFee: {
        type: Number,
        default: 0
    },
    computerFee: {
        type: Number,
        required: true
    },
    examFee: {
        type: Number,
        required: true
    },
    totalFee: {
        type: Number,
        required: true
    },
    dueDate: {
        type: Date,
        default: function() {
            // Default to 15 days from creation date
            return new Date(new Date().setDate(new Date().getDate() + 15));
        }
    }
}, {
    timestamps: true
});

// Fee Payment Schema
const feePaymentSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    academicYear: {
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
    feeStructure: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FeeStructure',
        required: true
    },
    payments: [{
        amount: {
            type: Number,
            required: true
        },
        paymentDate: {
            type: Date,
            default: Date.now
        },
        paymentMode: {
            type: String,
            enum: ['cash', 'cheque', 'online'],
            required: true
        },
        transactionId: String,
        receivedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        receipt: {
            number: String,
            generatedAt: Date,
            logs: [{
                action: String,
                at: Date
            }]
        }
    }],
    totalPaid: {
        type: Number,
        default: 0
    },
    totalToBePaid: {
        type: Number,
        required: true
    },
    balance: {
        type: Number,
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['paid', 'partial', 'pending', 'overdue'],
        default: 'pending'
    },
    remarks: String
}, {
    timestamps: true
});

// Indexes for efficient queries
feeStructureSchema.index({ class: 1, academicYear: 1 }, { unique: true });
feePaymentSchema.index({ student: 1, academicYear: 1 });

// Calculate total fee before saving fee structure
feeStructureSchema.pre('save', function(next) {
    // Ensure all fee values are numbers, default to 0 if undefined
    const tuitionFee = Number(this.tuitionFee) || 0;
    const libraryFee = Number(this.libraryFee) || 0;
    const laboratoryFee = Number(this.laboratoryFee) || 0;
    const transportFee = Number(this.transportFee) || 0;
    const computerFee = Number(this.computerFee) || 0;
    const examFee = Number(this.examFee) || 0;

    // Calculate total by adding all fees
    this.totalFee = tuitionFee + 
                    libraryFee + 
                    laboratoryFee + 
                    transportFee + 
                    computerFee + 
                    examFee;

    // Log the calculation for verification
    console.log('Fee Structure Total Calculation:', {
        tuitionFee,
        libraryFee,
        laboratoryFee,
        transportFee,
        computerFee,
        examFee,
        total: this.totalFee
    });

    next();
});

// Update status and balance when payment is added or totalToBePaid changes
feePaymentSchema.pre('save', async function(next) {
    try {
        // Always calculate total paid amount from the payments array
        this.totalPaid = this.payments.reduce((sum, payment) => sum + payment.amount, 0);

        // Ensure totalToBePaid is set (should be set by controllers)
        if (typeof this.totalToBePaid !== 'number' || this.totalToBePaid <= 0) {
            console.warn(`FeePayment ${this._id}: totalToBePaid is missing or invalid. This should be set by the controller.`);
            // Don't set a fallback value here - let the controller handle it
        }

        // Calculate balance: totalToBePaid - totalPaid
        if (typeof this.totalToBePaid === 'number') {
            this.balance = this.totalToBePaid - this.totalPaid;
        } else {
            console.error(`FeePayment ${this._id}: Cannot calculate balance without totalToBePaid`);
            this.balance = 0;
        }

        // Always update status based on the final balance and due date
        if (this.balance <= 0) {
            this.status = 'paid';
        } else if (this.balance < this.totalToBePaid) {
            this.status = 'partial';
        } else if (this.dueDate && this.dueDate < new Date() && this.balance > 0) { // Only overdue if balance > 0
            this.status = 'overdue';
        } else {
            this.status = 'pending';
        }

        next();
    } catch (error) {
        console.error(`Error in FeePayment pre-save for ${this._id}:`, error);
        next(error);
    }
});

// Static methods for Fee Structure
feeStructureSchema.statics.getFeeStructure = async function(classData, academicYear) {
    return this.findOne({ class: classData, academicYear });
};

// Static methods for Fee Payment
feePaymentSchema.statics.getStudentFees = async function(studentId, academicYear) {
    return this.find({ 
        student: studentId,
        academicYear: academicYear || new Date().getFullYear().toString()
    })
    .populate('feeStructure')
    .sort('-dueDate');
};

// Centralized method to calculate fee totals and ensure consistency
feePaymentSchema.statics.calculateFeeTotals = async function(studentId, academicYear) {
    const currentYear = academicYear || new Date().getFullYear().toString();
    
    // Get student with discount
    const User = mongoose.model('User');
    const student = await User.findById(studentId).select('+discount');
    if (!student) {
        throw new Error('Student not found');
    }

    // Get fee structure
    const feeStructure = await FeeStructure.getFeeStructure(student.studentInfo.class, currentYear);
    if (!feeStructure) {
        throw new Error('Fee structure not found');
    }

    // Get existing payment records
    const paymentRecords = await this.find({ 
        student: studentId,
        academicYear: currentYear
    }).sort('-createdAt');

    // Calculate totals
    const totalToBePaid = feeStructure.totalFee - (student.discount || 0);
    const totalPaid = paymentRecords.reduce((sum, record) => sum + record.totalPaid, 0);
    const balance = totalToBePaid - totalPaid;

    // Get or create payment record
    let paymentRecord = paymentRecords[0];
    if (!paymentRecord) {
        // Create new payment record
        paymentRecord = new this({
            student: studentId,
            academicYear: currentYear,
            class: student.studentInfo.class,
            section: student.studentInfo.section,
            feeStructure: feeStructure._id,
            payments: [],
            totalPaid: 0,
            totalToBePaid: totalToBePaid,
            balance: totalToBePaid,
            dueDate: feeStructure.dueDate || new Date(new Date().setDate(new Date().getDate() + 15)),
            status: 'pending'
        });
    } else {
        // Update existing record
        paymentRecord.totalToBePaid = totalToBePaid;
        paymentRecord.balance = balance;
        // Status will be updated by pre-save middleware
    }

    return {
        student,
        feeStructure,
        paymentRecord,
        totals: {
            totalToBePaid,
            totalPaid,
            balance
        }
    };
};

feePaymentSchema.statics.addPayment = async function(paymentData) {
    const feePayment = await this.findOne({ 
        student: paymentData.student,
        academicYear: paymentData.academicYear
    });

    if (!feePayment) {
        return this.create(paymentData);
    }

    feePayment.payments.push(paymentData.payment);
    return feePayment.save();
};

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);
const FeePayment = mongoose.model('FeePayment', feePaymentSchema);

export { FeeStructure, FeePayment };
