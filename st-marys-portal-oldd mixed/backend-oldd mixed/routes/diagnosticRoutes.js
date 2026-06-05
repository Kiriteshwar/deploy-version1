import express from 'express';
import net from 'net';
import dns from 'dns';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import User from '../models/userModel.js';
import CommunicationLog from '../models/communicationLogModel.js';

const router = express.Router();

// All diagnostic routes require admin
router.use(protect, adminOnly);

// ─────────────────────────────────────────────────────────────
// GET /api/diag/smtp-test — Verify DNS + connectivity to SMTP
// ─────────────────────────────────────────────────────────────
router.get('/smtp-test', async (req, res) => {
    const host = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
    const results = { host, dns: null, errors: [] };

    try {
        // Step 1: DNS lookup (IPv4 only)
        results.dns = await new Promise((resolve, reject) => {
            dns.resolve4(host, (err, addresses) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(addresses);
                }
            });
        });
    } catch (err) {
        results.errors.push(`DNS lookup failed: ${err.message}`);
    }

    // Step 2: Attempt raw TCP connection
    const port = parseInt(process.env.EMAIL_PORT) || 587;
    results.port = port;

    try {
        const socketResult = await new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(8000);

            socket.on('connect', () => {
                socket.destroy();
                resolve({ success: true, message: 'TCP connection established' });
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve({ success: false, message: 'Connection timed out after 8s' });
            });

            socket.on('error', (err) => {
                socket.destroy();
                resolve({ success: false, message: err.message });
            });

            socket.connect(port, host);
        });

        results.tcpConnection = socketResult;
    } catch (err) {
        results.errors.push(`Socket error: ${err.message}`);
    }

    // Step 3: Check env vars
    results.env = {
        EMAIL_HOST: process.env.EMAIL_HOST || '(not set)',
        EMAIL_PORT: process.env.EMAIL_PORT || '(not set)',
        EMAIL_USER: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 4)}...` : '(not set)',
        EMAIL_PASS: process.env.EMAIL_PASS ? '***present***' : '(not set)',
        EMAIL_FROM: process.env.EMAIL_FROM || '(not set)',
        BREVO_API_KEY: process.env.BREVO_API_KEY ? '***present***' : '(not set)',
        NODE_ENV: process.env.NODE_ENV || '(not set)'
    };

    // Step 4: Try Nodemailer transporter creation
    try {
        const nodemailer = (await import('nodemailer')).default;
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user: process.env.EMAIL_USER || '',
                pass: process.env.EMAIL_PASS || ''
            },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 5000
        });

        results.transporterCreated = true;
        results.verifyResult = await new Promise((resolve) => {
            transporter.verify((err, success) => {
                if (err) {
                    resolve({ success: false, error: err.message, code: err.code });
                } else {
                    resolve({ success: true });
                }
            });
        });
    } catch (err) {
        results.transporterCreated = false;
        results.verifyResult = { success: false, error: err.message };
    }

    results.conclusion = determineConclusion(results);
    res.json({ success: true, diagnostics: results });
});

// ─────────────────────────────────────────────────────────────
// GET /api/diag/port-test — Test multiple ports
// ─────────────────────────────────────────────────────────────
router.get('/port-test', async (req, res) => {
    const host = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
    const ports = [25, 465, 587, 2525];
    const results = { host, portResults: [] };

    for (const port of ports) {
        try {
            const socketResult = await new Promise((resolve) => {
                const socket = new net.Socket();
                socket.setTimeout(5000);
                const start = Date.now();

                socket.on('connect', () => {
                    socket.destroy();
                    resolve({ port, success: true, ms: Date.now() - start });
                });

                socket.on('timeout', () => {
                    socket.destroy();
                    resolve({ port, success: false, error: 'timeout', ms: 5000 });
                });

                socket.on('error', (err) => {
                    socket.destroy();
                    resolve({ port, success: false, error: err.message, ms: Date.now() - start });
                });

                socket.connect(port, host);
            });
            results.portResults.push(socketResult);
        } catch (err) {
            results.portResults.push({ port, success: false, error: err.message });
        }
    }

    res.json({ success: true, diagnostics: results });
});

// ─────────────────────────────────────────────────────────────
// GET /api/diag/brevo-api-test — Send via Brevo HTTP API
// ─────────────────────────────────────────────────────────────
router.get('/brevo-api-test', async (req, res) => {
    const apiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || 'noreply@stmarysschool.edu';
    const testTo = req.query.to || process.env.EMAIL_USER || '';

    if (!apiKey) {
        return res.json({
            success: false,
            message: 'BREVO_API_KEY not configured. Cannot test Brevo HTTP API.',
            envCheck: {
                BREVO_API_KEY: process.env.BREVO_API_KEY ? '***present***' : '(not set)',
                EMAIL_FROM: process.env.EMAIL_FROM || '(not set)'
            }
        });
    }

    if (!testTo) {
        return res.json({
            success: false,
            message: 'No recipient email. Add ?to=your@email.com or set EMAIL_USER.',
            instructions: 'Pass ?to=your@email.com to send a test email'
        });
    }

    const subject = `[SMTP Diagnostic] Test from Render @ ${new Date().toISOString()}`;
    const htmlContent = `
        <h2>Brevo API Test</h2>
        <p>This email was sent via <strong>Brevo HTTP API</strong> (not SMTP).</p>
        <p>If you received this, then <strong>Brevo HTTP API works</strong> and the problem is SMTP-specific.</p>
        <hr>
        <p><strong>Server Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
    `;

    try {
        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: "St. Mary's School", email: fromEmail },
                to: [{ email: testTo, name: 'Test Recipient' }],
                subject: subject,
                htmlContent: htmlContent
            })
        });

        const responseBody = await brevoRes.text();

        let parsed;
        try {
            parsed = JSON.parse(responseBody);
        } catch {
            parsed = { raw: responseBody };
        }

        res.json({
            success: brevoRes.ok,
            statusCode: brevoRes.status,
            statusText: brevoRes.statusText,
            response: parsed,
            requestDetails: {
                to: testTo,
                from: fromEmail,
                subject: subject,
                apiKeyPresent: !!apiKey,
                apiKeyPrefix: apiKey.substring(0, 8) + '...'
            }
        });
    } catch (err) {
        res.json({
            success: false,
            error: err.message,
            requestDetails: {
                to: testTo,
                from: fromEmail,
                apiKeyPresent: !!apiKey
            }
        });
    }
});

// ─────────────────────────────────────────────────────────────
// Helper: Determine root cause conclusion
// ─────────────────────────────────────────────────────────────
function determineConclusion(results) {
    const lines = [];

    if (results.errors.length > 0) {
        lines.push(`⚠ DNS/connection errors detected: ${results.errors.join('; ')}`);
    }

    if (results.dns && results.dns.length > 0) {
        lines.push(`✅ DNS resolved: ${results.dns.join(', ')}`);
    } else {
        lines.push('❌ DNS resolution failed');
    }

    if (results.tcpConnection) {
        if (results.tcpConnection.success) {
            lines.push('✅ TCP connection to SMTP host:PORT succeeded');
        } else {
            lines.push(`❌ TCP connection failed: ${results.tcpConnection.message}`);
            lines.push('');
            lines.push('🛑 Conclusion: Render is likely blocking outbound SMTP traffic.');
            lines.push('   Solution: Use Brevo HTTP API instead of SMTP.');
            lines.push('   Set BREVO_API_KEY in Render environment variables.');
        }
    }

    if (results.verifyResult && results.verifyResult.success) {
        lines.push('✅ SMTP transporter.verify() succeeded');
    } else if (results.verifyResult) {
        lines.push(`❌ SMTP verify failed: ${results.verifyResult.error} (code: ${results.verifyResult.code})`);
    }

    return lines.join('\n');
}

export default router;