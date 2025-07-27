import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    date: { type: Date, default: Date.now },
    category: { 
        type: String, 
        required: true,
        enum: ['general', 'exam', 'event', 'holiday', 'sports']
    },
    author: { type: String, default: 'Admin' },
    attachment: { type: String },
    important: { type: Boolean, default: false },
    targetClass: { type: String, default: 'all' },
    targetSection: { type: String, default: 'all' }
}, { timestamps: true });

const Notice = mongoose.model('Notice', noticeSchema);

export default Notice;
