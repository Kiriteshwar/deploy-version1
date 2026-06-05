/**
 * Notification Service - Abstraction Layer
 * 
 * Currently only Email is active. WhatsApp is a placeholder.
 * When WhatsApp API is purchased, only update sendWhatsAppNotification().
 * No other code changes should be required.
 */
import * as emailService from './emailService.js';
import CommunicationLog from '../models/communicationLogModel.js';

/**
 * Send notification via email (ACTIVE)
 */
export const sendEmailNotification = async ({ type, data, sentBy }) => {
    let result;

    switch (type) {
        case 'absence':
            result = await emailService.sendAbsentNotification(data);
            break;
        case 'fees':
            result = await emailService.sendFeeReminder(data);
            break;
        case 'birthday':
            result = await emailService.sendBirthdayWish(data);
            break;
        case 'announcement':
            result = await emailService.sendAnnouncement(data);
            break;
        case 'custom':
        default:
            result = await emailService.sendCustomMessage(data);
            break;
    }

    // Log the communication
    try {
        await CommunicationLog.create({
            recipientName: data.name || 'Unknown',
            recipientEmail: data.email || data.parentEmail,
            notificationType: type,
            subject: data.subject || '',
            message: data.message || '',
            channel: 'email',
            status: result.success ? 'sent' : 'failed',
            errorMessage: result.error || null,
            studentRef: data.studentRef || null,
            teacherRef: data.teacherRef || null,
            adminRef: data.adminRef || null,
            sentBy: sentBy || null,
            sentAt: new Date()
        });
    } catch (logError) {
        console.error('[NotificationService] Failed to log communication:', logError.message);
    }

    return result;
};

/**
 * Send bulk email notifications
 */
export const sendBulkEmailNotification = async ({ type, recipients, sentBy }) => {
    const results = [];
    for (const recipient of recipients) {
        const result = await sendEmailNotification({ type, data: recipient, sentBy });
        results.push({ ...recipient, ...result });
    }
    return results;
};

/**
 * Send notification via WhatsApp (PLACEHOLDER)
 * 
 * To activate: 
 * 1. Install Twilio / Meta WhatsApp Cloud SDK
 * 2. Implement actual sending logic below
 * 3. Set WHATSAPP_ENABLED=true in env
 */
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true' || false;

export const sendWhatsAppNotification = async ({ type, data, sentBy }) => {
    if (!WHATSAPP_ENABLED) {
        console.log('[WhatsApp-PLACEHOLDER] WhatsApp not yet configured. Would send:', {
            type,
            to: data.phone,
            message: data.message || `${type} notification`
        });

        // Log placeholder
        try {
            await CommunicationLog.create({
                recipientName: data.name || 'Unknown',
                recipientPhone: data.phone,
                notificationType: type,
                subject: data.subject || '',
                message: data.message || '',
                channel: 'whatsapp',
                status: 'pending',
                errorMessage: 'WhatsApp not yet configured',
                studentRef: data.studentRef || null,
                teacherRef: data.teacherRef || null,
                adminRef: data.adminRef || null,
                sentBy: sentBy || null,
                sentAt: new Date()
            });
        } catch (logError) {
            console.error('[NotificationService] Failed to log WhatsApp placeholder:', logError.message);
        }

        return { 
            success: false, 
            error: 'WhatsApp not yet configured',
            placeholder: true
        };
    }

    // --- FUTURE: Real WhatsApp implementation goes here ---
    // Example with Twilio:
    // const twilioClient = require('twilio')(TWILIO_SID, TWILIO_AUTH_TOKEN);
    // const result = await twilioClient.messages.create({
    //     body: data.message,
    //     from: 'whatsapp:+14155238886',
    //     to: `whatsapp:${data.phone}`
    // });
    // return { success: true, messageId: result.sid };
    // 
    // Or with Meta WhatsApp Cloud API:
    // const response = await axios.post(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
    //     messaging_product: "whatsapp",
    //     to: data.phone,
    //     type: "template",
    //     template: { name: "...", language: { code: "en" } }
    // }, {
    //     headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    // });

    console.log('[WhatsApp] Real WhatsApp API not yet implemented.');
    return { success: false, error: 'WhatsApp API not yet implemented' };
};