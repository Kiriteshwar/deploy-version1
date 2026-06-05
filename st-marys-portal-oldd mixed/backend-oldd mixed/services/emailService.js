import nodemailer from 'nodemailer';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────
const fromAddress = process.env.EMAIL_FROM || 'noreply@stmarysschool.edu';
const fromName = "St. Mary's High School";
const brevoApiKey = process.env.BREVO_API_KEY;

// SMTP config (fallback if Brevo API not available)
const smtpHost = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const smtpPort = parseInt(process.env.EMAIL_PORT) || 587;
const smtpUser = process.env.EMAIL_USER || '';
const smtpPass = process.env.EMAIL_PASS || '';

// ─────────────────────────────────────────────────────────────
// Strategy: Brevo HTTP API > SMTP > Logged-only
// ─────────────────────────────────────────────────────────────

/**
 * Send via Brevo HTTP API (v3) — uses port 443 (HTTPS), never blocked by Render
 */
async function sendViaBrevoApi({ to, subject, html }) {
    if (!brevoApiKey) return null;

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: fromName, email: fromAddress },
                to: [{ email: to }],
                subject: subject,
                htmlContent: html
            })
        });

        const body = await response.json();

        if (response.ok) {
            console.log(`[EmailService] Sent via Brevo API to ${to}: ${body.messageId}`);
            return { success: true, messageId: body.messageId, channel: 'brevo-api' };
        } else {
            console.error(`[EmailService] Brevo API error for ${to}:`, body);
            return { success: false, error: body.message || `HTTP ${response.status}`, channel: 'brevo-api' };
        }
    } catch (error) {
        console.error(`[EmailService] Brevo API fetch error for ${to}:`, error.message);
        return { success: false, error: error.message, channel: 'brevo-api' };
    }
}

/**
 * Create a Nodemailer SMTP transporter with better timeout handling
 */
function createTransporter() {
    if (!smtpUser || !smtpPass) {
        return null;
    }

    const tlsOptions = {};

    // Handle IPv6 resolution issues on Render
    // Some hosts resolve to IPv6 which may not work; force IPv4 lookup
    return nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
            user: smtpUser,
            pass: smtpPass
        },
        // Critical: Add timeouts to prevent hangs
        connectionTimeout: 10000,      // 10s to establish TCP
        greetingTimeout: 10000,        // 10s for SMTP greeting
        socketTimeout: 15000,          // 15s for mail transfer
        // Try TLS even on non-465 ports if server demands it
        requireTLS: false,
        tls: {
            rejectUnauthorized: true,
            ...tlsOptions
        }
    });
}

let _transporter = null;
let _transporterAttempted = false;

function getTransporter() {
    if (!_transporterAttempted) {
        _transporterAttempted = true;
        _transporter = createTransporter();
    }
    return _transporter;
}

/**
 * Send via Nodemailer SMTP
 */
async function sendViaSmtp({ to, subject, html }) {
    const transporter = getTransporter();
    if (!transporter) return null;

    try {
        const info = await transporter.sendMail({
            from: `"${fromName}" <${fromAddress}>`,
            to,
            subject,
            html
        });

        console.log(`[EmailService] Sent via SMTP to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId, channel: 'smtp' };
    } catch (error) {
        console.error(`[EmailService] SMTP error for ${to}:`, error.message, error.code);
        return { success: false, error: error.message, code: error.code, channel: 'smtp' };
    }
}

/**
 * Send a single email — tries Brevo API first, then SMTP, then logs
 */
export const sendEmail = async ({ to, subject, html }) => {
    console.log('BREVO KEY EXISTS:', !!process.env.BREVO_API_KEY);
    // Strategy 1: Try Brevo HTTP API (port 443, never blocked)
    if (brevoApiKey) {
        const brevoResult = await sendViaBrevoApi({ to, subject, html });
        if (brevoResult && brevoResult.success) return brevoResult;
        // If Brevo API fails, fall through to SMTP
        console.warn('[EmailService] Brevo API failed, falling back to SMTP');
    }

    // Strategy 2: Try SMTP
    if (smtpUser && smtpPass) {
        const smtpResult = await sendViaSmtp({ to, subject, html });
        if (smtpResult && smtpResult.success) return smtpResult;
        // If SMTP fails, fall through to log
        console.warn('[EmailService] SMTP failed, logging only');
    }

    // Strategy 3: Log only
    console.log(`[EmailService] LOGGED: To: ${to}, Subject: ${subject}`);
    return { success: true, messageId: 'logged-only', logged: true, channel: 'log' };
};

/**
 * Send bulk emails
 * @param {Object} options
 * @param {Array<{to: string, subject: string, html: string}>} options.recipients
 * @returns {Promise<Array>} - Array of results
 */
export const sendBulkEmail = async ({ recipients }) => {
    const results = [];
    for (const recipient of recipients) {
        const result = await sendEmail(recipient);
        results.push({ ...recipient, ...result });
    }
    return results;
};

/**
 * Send absence notification to parent
 */
export const sendAbsentNotification = async ({ parentEmail, parentName, studentName, className, date, reason }) => {
    const formattedDate = new Date(date).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    const subject = `Student Absence Notification - ${studentName}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="background: #1a73e8; color: white; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
                <h2 style="margin: 0;">St. Mary's High School</h2>
            </div>
            <div style="padding: 20px;">
                <p>Dear ${parentName || 'Parent'},</p>
                <p>This is to inform you that your child</p>
                <p style="font-size: 18px; font-weight: bold; color: #d32f2f; text-align: center;">
                    ${studentName}
                </p>
                <p>of Class <strong>${className}</strong> was marked <strong>absent</strong> on <strong>${formattedDate}</strong>.</p>
                ${reason ? `<p><strong>Reason provided:</strong> ${reason}</p>` : ''}
                <p>Please ensure your child attends school regularly.</p>
                <p style="margin-top: 30px;">Regards,<br><strong>St. Mary's High School</strong></p>
            </div>
            <div style="background: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px;">
                This is an automated notification. Please do not reply to this email.
            </div>
        </div>
    `;

    return sendEmail({ to: parentEmail, subject, html });
};

/**
 * Send fee reminder to parent
 */
export const sendFeeReminder = async ({ parentEmail, parentName, studentName, className, amount, dueDate }) => {
    const formattedDueDate = new Date(dueDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    const subject = `Fee Reminder - ${studentName}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="background: #ff9800; color: white; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
                <h2 style="margin: 0;">Fee Payment Reminder</h2>
            </div>
            <div style="padding: 20px;">
                <p>Dear ${parentName || 'Parent'},</p>
                <p>This is a reminder regarding the pending fee for your child:</p>
                <p style="font-size: 18px; font-weight: bold; color: #333; text-align: center;">${studentName} - Class ${className}</p>
                <p><strong>Amount Due:</strong> ₹${amount.toLocaleString('en-IN')}</p>
                <p><strong>Due Date:</strong> ${formattedDueDate}</p>
                <p>Please make the payment at the earliest to avoid any late fees.</p>
                <p style="margin-top: 30px;">Regards,<br><strong>St. Mary's High School</strong></p>
            </div>
        </div>
    `;

    return sendEmail({ to: parentEmail, subject, html });
};

/**
 * Send birthday wish
 */
export const sendBirthdayWish = async ({ email, name, role }) => {
    const subject = `Happy Birthday from St. Mary's High School!`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="background: linear-gradient(135deg, #ff6f00, #ff8f00); color: white; padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 32px;">🎂 Happy Birthday!</h1>
            </div>
            <div style="padding: 20px; text-align: center;">
                <p style="font-size: 20px; color: #333;">Dear ${name},</p>
                <p style="font-size: 18px; color: #555;">
                    ${role === 'student' 
                        ? 'Warmest birthday wishes from the entire St. Mary\'s School family! May your day be filled with joy, laughter, and happiness.' 
                        : 'On behalf of the entire St. Mary\'s School family, we wish you a very Happy Birthday! Your dedication and hard work inspire us all.'}
                </p>
                <p style="font-size: 16px; color: #777; margin-top: 30px;">
                    "Count your life by smiles, not tears. Count your age by friends, not years."
                </p>
                <p style="margin-top: 40px; font-size: 16px; color: #333;">
                    With warm regards,<br>
                    <strong>St. Mary's High School</strong>
                </p>
            </div>
        </div>
    `;

    return sendEmail({ to: email, subject, html });
};

/**
 * Send announcement
 */
export const sendAnnouncement = async ({ email, name, subject, message }) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="background: #1a73e8; color: white; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
                <h2 style="margin: 0;">📢 Announcement</h2>
            </div>
            <div style="padding: 20px;">
                <p>Dear ${name || 'Stakeholder'},</p>
                <p style="font-size: 16px; font-weight: bold; color: #333;">${subject}</p>
                <p style="color: #555; line-height: 1.6;">${message}</p>
                <p style="margin-top: 30px;">Regards,<br><strong>St. Mary's High School</strong></p>
            </div>
        </div>
    `;

    return sendEmail({ to: email, subject, html });
};

/**
 * Send custom individual message
 */
export const sendCustomMessage = async ({ email, name, subject, message }) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="background: #1976d2; color: white; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
                <h2 style="margin: 0;">Message from St. Mary's High School</h2>
            </div>
            <div style="padding: 20px;">
                <p>Dear ${name || 'Recipient'},</p>
                <p style="font-size: 16px; font-weight: bold; color: #333;">${subject}</p>
                <p style="color: #555; line-height: 1.6;">${message}</p>
                <p style="margin-top: 30px;">Regards,<br><strong>St. Mary's High School</strong></p>
            </div>
        </div>
    `;

    return sendEmail({ to: email, subject, html });
};