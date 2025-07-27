import mongoose from 'mongoose';

const subjectSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    code: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    teachers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    isElective: {
      type: Boolean,
      default: false
    },
    category: {
      type: String,
      enum: ['core', 'elective', 'language', 'practical', 'other'],
      default: 'core'
    },
    applicableClasses: [{
      type: String
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
    },
    versionKey: '__v'
  }
);

// Add index on name for faster lookups
subjectSchema.index({ name: 1 });

const Subject = mongoose.model('Subject', subjectSchema);

export default Subject; 