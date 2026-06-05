import nodemailer from 'nodemailer';

// Create reusable transporter
const createTransporter = () => {
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.EMAIL_PORT) || 587;
    const user = process.env.EMAIL_USER || '';
    const pass = process.env.EMAIL_PASS || '';

    if (!user || !pass) {
        console.warn('[EmailService] EMAIL_USER or EMAIL_PASS not configured. Emails will be logged only.');
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass
        },
    });
};

const fromAddress = process.env.EMAIL_FROM || 'noreply@stmarysschool.edu';

/**
 * Send a single email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body content
 * @returns {Promise<Object>} - { success, messageId, error }
 */
export const sendEmail = async ({ to, subject, html }) => {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT;
    const transporter = createTransporter();

    if (!transporter) {
        console.log('[EmailService] No transporter configured');
        return { success: true, messageId: 'logged-only', logged: true };
    }

    try {
       
        console.log('[EmailService] Sending email...');

        console.log('[EmailService] About to send');
        console.log({
            host,
            port,
            to,
            from: fromAddress
        });

        const info = await transporter.sendMail({
            from: `"St. Mary's High School" <${fromAddress}>`,
            to,
            subject,
            html
        });

        console.log(`[EmailService] Sent to ${to}: ${info.messageId}`);

        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        console.error('[EmailService] Error:', error);

        return {
            success: false,
            error: error.message
        };
    }
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
    const subject = `Happy Birthday from St. Mary's School!`;
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
                <h2 style="margin: 0;">Message from St. Mary's School</h2>
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