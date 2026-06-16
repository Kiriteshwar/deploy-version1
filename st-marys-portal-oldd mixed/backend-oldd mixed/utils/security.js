import crypto from 'crypto';
import path from 'path';

const MAX_TEXT_LENGTH = 5000;
const SAFE_UPLOAD_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt',
    '.stl', '.obj', '.fbx', '.zip', '.rar', '.png', '.jpg', '.jpeg', '.gif'
]);

const MAGIC_BYTES = {
    '.pdf': [Buffer.from('%PDF')],
    '.png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    '.jpg': [Buffer.from([0xff, 0xd8, 0xff])],
    '.jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
    '.gif': [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
    '.zip': [Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.from([0x50, 0x4b, 0x07, 0x08])],
    '.docx': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
    '.xlsx': [Buffer.from([0x50, 0x4b, 0x03, 0x04])]
};

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const limitedRegex = (value, maxLength = 64) => {
    const normalized = String(value || '').trim().slice(0, maxLength);
    return new RegExp(escapeRegex(normalized), 'i');
};

export const sanitizeText = (value, maxLength = MAX_TEXT_LENGTH) => {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, maxLength);
};

export const sanitizeObjectStrings = (input) => {
    if (Array.isArray(input)) {
        return input.map(sanitizeObjectStrings);
    }
    if (input && typeof input === 'object') {
        return Object.fromEntries(
            Object.entries(input).map(([key, value]) => [key, sanitizeObjectStrings(value)])
        );
    }
    return typeof input === 'string' ? sanitizeText(input) : input;
};

export const createSafeUploadFilename = (originalName = 'upload.bin') => {
    const ext = path.extname(originalName).toLowerCase();
    const safeExt = SAFE_UPLOAD_EXTENSIONS.has(ext) ? ext : '.bin';
    return `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${safeExt}`;
};

export const isAllowedUploadExtension = (originalName, allowedExtensions = SAFE_UPLOAD_EXTENSIONS) => {
    return allowedExtensions.has(path.extname(originalName || '').toLowerCase());
};

export const hasValidMagicBytes = (file) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const signatures = MAGIC_BYTES[ext];
    // If no magic bytes defined for this extension, fail closed (block the upload)
    if (!signatures) return false;
    return signatures.some((signature) => file.buffer?.subarray(0, signature.length).equals(signature));
};

export const safeObjectIdFilter = (id) => /^[a-fA-F0-9]{24}$/.test(String(id || ''));
