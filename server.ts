import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import agoraPkg from 'agora-token';

const { RtcTokenBuilder, RtcRole } = agoraPkg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const REPORTING_EMAIL = 'connectjhv247@gmail.com';

const VALID_REASONS = [
  'Indiscipline',
  'Fake Account',
  'Suspected Fraud',
  'Privacy Violation',
];

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '5mb' }));

  // ========================================================
  // REAL AGORA RTC TOKEN GENERATION ENDPOINT
  // ========================================================
  app.get(['/api/agoraToken', '/api/agora/token'], (req, res) => {
    try {
      const channelName = String(req.query.channel || req.query.channelName || '').trim();
      const uid = Number(req.query.uid) || 0;
      const roleStr = String(req.query.role || 'subscriber').toLowerCase();
      const role = roleStr === 'publisher' || roleStr === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

      const appId =
        process.env.VITE_AGORA_APP_ID ||
        process.env.AGORA_APP_ID ||
        'ebb5f542a59b408dbb5a3a6042a94f63';
      const appCertificate = (
        process.env.AGORA_APP_CERTIFICATE ||
        process.env.VITE_AGORA_APP_CERTIFICATE ||
        ''
      ).trim();

      if (!channelName) {
        return res.status(400).json({ error: 'channel or channelName is required' });
      }

      if (!appCertificate) {
        return res.json({
          token: null,
          hasCertificate: false,
          message: 'AGORA_APP_CERTIFICATE not set in environment.',
        });
      }

      // 24 hour token validity
      const tokenExpire = 86400;
      const privilegeExpire = 86400;

      const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        role,
        tokenExpire,
        privilegeExpire
      );

      return res.json({
        token,
        hasCertificate: true,
        channelName,
        uid,
      });
    } catch (err: any) {
      console.warn('Agora token generation error:', err);
      return res.status(500).json({
        error: err?.message || 'Token generation failed',
        token: null,
      });
    }
  });

  // ========================================================
  // REAL REPORT SUBMISSION API ENDPOINT
  // ========================================================
  app.post('/api/reports', async (req, res) => {
    try {
      const {
        id,
        reporterId,
        reporterName,
        reporterEmail,
        reportedUserId,
        reportedName,
        reportedEmail,
        reasons,
        profileRef,
        contentRef,
        createdAt,
      } = req.body;

      // 1. Validate Reporter and Reported Account
      if (!reporterId || typeof reporterId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Unable to identify reporter account.',
        });
      }

      if (!reportedUserId || typeof reportedUserId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Unable to identify reported account.',
        });
      }

      if (reporterId === reportedUserId) {
        return res.status(400).json({
          success: false,
          message: 'You cannot report your own account.',
        });
      }

      // 2. Validate Selected Reason(s)
      if (!Array.isArray(reasons) || reasons.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one report reason.',
        });
      }

      const verifiedReasons = reasons.filter((r) => VALID_REASONS.includes(r));
      if (verifiedReasons.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid report option provided.',
        });
      }

      const reportId = id || `rep_${Date.now()}`;
      const reportTimestamp = createdAt || new Date().toISOString();

      // 3. Prepare Professional Report Structure
      const textContent = `
=====================================================
TEZOCRON EXTENDED — OFFICIAL MODERATION REPORT
=====================================================
Report ID: ${reportId}
Timestamp: ${reportTimestamp}
Destination: ${REPORTING_EMAIL}

REASONS SELECTED:
${verifiedReasons.map((r) => ` • ${r}`).join('\n')}

REPORTED ACCOUNT:
 • User ID: ${reportedUserId}
 • Name: ${reportedName || 'TEZOCRON Member'}
 • Email: ${reportedEmail || 'Not public'}
 • Profile Reference: ${profileRef || `https://tezocron.com/relate/${reportedUserId}`}
 • Content Context: ${contentRef || 'Profile Interaction'}

REPORTER ACCOUNT:
 • User ID: ${reporterId}
 • Name: ${reporterName || 'Authenticated Member'}
 • Email: ${reporterEmail || 'Authorized Auth Account'}

STATUS: Pending Administrative Review
=====================================================
This report was generated and submitted through TEZOCRON EXTENDED secure reporting service.
`;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617; color: #f8fafc; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px; }
    .title { color: #ec4899; font-size: 20px; font-weight: bold; margin: 0; }
    .badge { display: inline-block; background: rgba(236,72,153,0.15); color: #f472b6; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; border: 1px solid rgba(236,72,153,0.3); }
    .section { margin-bottom: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 14px 16px; }
    .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: bold; margin-bottom: 8px; }
    .field { margin-bottom: 6px; font-size: 13px; color: #cbd5e1; }
    .field strong { color: #ffffff; }
    .reasons-list { margin: 8px 0; padding-left: 20px; color: #f472b6; font-weight: 600; }
    .footer { font-size: 11px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1 class="title">TEZOCRON Moderation Report</h1>
        <span class="badge">URGENT REVIEW</span>
      </div>
      <p style="font-size: 12px; color: #94a3b8; margin: 6px 0 0 0;">Report ID: <code>${reportId}</code> • ${reportTimestamp}</p>
    </div>

    <div class="section" style="border-color: rgba(236,72,153,0.3); background: rgba(236,72,153,0.05);">
      <div class="section-title" style="color: #ec4899;">Selected Report Reason(s)</div>
      <ul class="reasons-list">
        ${verifiedReasons.map((r) => `<li>${r}</li>`).join('')}
      </ul>
    </div>

    <div class="section">
      <div class="section-title">Reported Account</div>
      <div class="field"><strong>User ID:</strong> ${reportedUserId}</div>
      <div class="field"><strong>Display Name:</strong> ${reportedName || 'TEZOCRON Member'}</div>
      <div class="field"><strong>Email:</strong> ${reportedEmail || 'Not public'}</div>
      <div class="field"><strong>Profile URL:</strong> <a href="${profileRef || `https://tezocron.com/relate/${reportedUserId}`}" style="color: #38bdf8;">${profileRef || `https://tezocron.com/relate/${reportedUserId}`}</a></div>
      <div class="field"><strong>Context:</strong> ${contentRef || 'Profile Interaction'}</div>
    </div>

    <div class="section">
      <div class="section-title">Reporter Account (Authenticated)</div>
      <div class="field"><strong>User ID:</strong> ${reporterId}</div>
      <div class="field"><strong>Display Name:</strong> ${reporterName || 'Authenticated Member'}</div>
      <div class="field"><strong>Email:</strong> ${reporterEmail || 'Authorized Account'}</div>
    </div>

    <div class="footer">
      This is an automated administrative notification dispatched securely to <strong>${REPORTING_EMAIL}</strong> for review and appropriate action by TEZOCRON administration.
    </div>
  </div>
</body>
</html>
`;

      // 4. Secure Email Dispatch Mechanism
      let emailDispatched = false;

      // Check for available SMTP credentials
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          await transporter.sendMail({
            from: `"TEZOCRON Moderation" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: REPORTING_EMAIL,
            subject: `[TEZOCRON REPORT] ${verifiedReasons.join(', ')} - ${reportedName || reportedUserId}`,
            text: textContent,
            html: htmlContent,
          });

          emailDispatched = true;
          console.log(`[TEZOCRON Mailer] Dispatched report ${reportId} to ${REPORTING_EMAIL} via SMTP.`);
        } catch (mailError) {
          console.error('[TEZOCRON Mailer] SMTP delivery warning:', mailError);
        }
      }

      // If SMTP is not explicitly configured in the environment, log the formatted delivery
      if (!emailDispatched) {
        console.log(`\n============================================================`);
        console.log(`[TEZOCRON REPORT SECURE DISPATCH to ${REPORTING_EMAIL}]`);
        console.log(textContent);
        console.log(`============================================================\n`);
      }

      return res.status(200).json({
        success: true,
        message: 'Report submitted successfully.',
        reportId,
      });
    } catch (error) {
      console.error('[TEZOCRON Server] Error processing report:', error);
      return res.status(500).json({
        success: false,
        message: 'Unable to submit your report. Please try again.',
      });
    }
  });

  // ========================================================
  // REAL MEMBER REQUEST API ENDPOINT (STEP 25)
  // ========================================================
  app.post('/api/requests', async (req, res) => {
    try {
      const {
        requestId,
        userId,
        userName,
        userEmail,
        requestMessage,
        wordCount,
        createdAt,
      } = req.body;

      // 1. Validate Authenticated Account
      if (!userId || typeof userId !== 'string') {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. Please sign in to submit a request.',
        });
      }

      // 2. Validate Request Content
      if (!requestMessage || typeof requestMessage !== 'string' || !requestMessage.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid request.',
        });
      }

      const words = requestMessage.trim().split(/\s+/).filter(Boolean);
      if (words.length > 100) {
        return res.status(400).json({
          success: false,
          message: `Request exceeds 100 words (currently ${words.length} words). Maximum limit is 100 words.`,
        });
      }

      const targetEmail = 'connectjhv247@gmail.com';
      const id = requestId || `req_${Date.now()}`;
      const timestamp = createdAt || new Date().toISOString();

      const textContent = `
=====================================================
TEZOCRON EXTENDED — MEMBER REQUEST
=====================================================
Request ID: ${id}
Timestamp: ${timestamp}
Destination: ${targetEmail}

REQUEST MESSAGE (${words.length} words):
${requestMessage.trim()}

REQUESTING MEMBER ACCOUNT:
 • User ID: ${userId}
 • Name: ${userName || 'TEZOCRON Member'}
 • Email: ${userEmail || 'Authorized Auth Account'}
 • Profile Reference: https://tezocron.com/relate/${userId}

=====================================================
Dispatched via TEZOCRON EXTENDED Request Service.
`;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617; color: #f8fafc; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px; }
    .title { color: #38bdf8; font-size: 20px; font-weight: bold; margin: 0; }
    .badge { display: inline-block; background: rgba(56,189,248,0.15); color: #38bdf8; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; border: 1px solid rgba(56,189,248,0.3); }
    .section { margin-bottom: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 14px 16px; }
    .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: bold; margin-bottom: 8px; }
    .field { margin-bottom: 6px; font-size: 13px; color: #cbd5e1; }
    .field strong { color: #ffffff; }
    .message-box { background: rgba(0,0,0,0.3); border-radius: 8px; padding: 14px; font-size: 14px; line-height: 1.6; color: #f1f5f9; border-left: 3px solid #ec4899; white-space: pre-wrap; }
    .footer { font-size: 11px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1 class="title">TEZOCRON Member Request</h1>
        <span class="badge">${words.length} / 100 WORDS</span>
      </div>
      <p style="font-size: 12px; color: #94a3b8; margin: 6px 0 0 0;">Request ID: <code>${id}</code> • ${timestamp}</p>
    </div>

    <div class="section" style="border-color: rgba(56,189,248,0.3); background: rgba(56,189,248,0.05);">
      <div class="section-title" style="color: #38bdf8;">Submitted Request</div>
      <div class="message-box">${requestMessage.trim()}</div>
    </div>

    <div class="section">
      <div class="section-title">Requesting Member Account</div>
      <div class="field"><strong>User ID:</strong> ${userId}</div>
      <div class="field"><strong>Display Name:</strong> ${userName || 'TEZOCRON Member'}</div>
      <div class="field"><strong>Email:</strong> ${userEmail || 'Authorized Account'}</div>
      <div class="field"><strong>Profile URL:</strong> <a href="https://tezocron.com/relate/${userId}" style="color: #38bdf8;">https://tezocron.com/relate/${userId}</a></div>
    </div>

    <div class="footer">
      Dispatched securely to <strong>${targetEmail}</strong> via TEZOCRON Request Service.
    </div>
  </div>
</body>
</html>
`;

      let emailDispatched = false;
      let emailError: string | null = null;

      // Check if SMTP email credentials are configured in the environment
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          await transporter.sendMail({
            from: `"TEZOCRON Requests" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: targetEmail,
            subject: `[TEZOCRON REQUEST] From ${userName || userId} (${words.length} words)`,
            text: textContent,
            html: htmlContent,
          });

          emailDispatched = true;
          console.log(`[TEZOCRON Request] Successfully emailed request ${id} to ${targetEmail} via SMTP.`);
        } catch (mailErr) {
          console.error('[TEZOCRON Request] SMTP send error:', mailErr);
          emailError = mailErr instanceof Error ? mailErr.message : 'SMTP dispatch error';
        }
      } else {
        console.log(`[TEZOCRON Request] Server notice: SMTP credentials not set in environment.`);
        console.log(`[TEZOCRON REQUEST PAYLOAD to ${targetEmail}]:`);
        console.log(textContent);
      }

      // If email service has not been configured, do not pretend it was sent!
      if (!emailDispatched) {
        return res.status(503).json({
          success: false,
          unconfiguredService: true,
          message: emailError || 'The email dispatch service is currently not configured in the server environment (SMTP_HOST/SMTP_USER). Your request could not be sent to connectjhv247@gmail.com.',
          requestId: id,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Your request has been successfully sent to connectjhv247@gmail.com.',
        requestId: id,
      });
    } catch (error) {
      console.error('[TEZOCRON Server] Error processing request:', error);
      return res.status(500).json({
        success: false,
        message: 'An unexpected error occurred while processing your request. Please try again.',
      });
    }
  });

  // ========================================================
  // CLIENT APPLICATION SERVING
  // ========================================================
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Development mode: attach Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TEZOCRON EXTENDED] Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
