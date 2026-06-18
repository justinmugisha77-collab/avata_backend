const fs = require('fs');
const path = require('path');
const https = require('https');

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getSenderDetails() {
  return {
    email: (process.env.FROM_EMAIL || 'noreply@avatrading.com').trim(),
    name: (process.env.FROM_NAME || 'AVATA Trading').trim()
  };
}

async function normalizeAttachments(attachments = []) {
  const normalized = [];

  for (const attachment of attachments) {
    if (!attachment) continue;

    const filename = attachment.filename || (attachment.path ? path.basename(attachment.path) : 'attachment');
    let content = attachment.content;

    if (!content && attachment.path && fs.existsSync(attachment.path)) {
      content = fs.readFileSync(attachment.path).toString('base64');
    }

    if (!content) continue;

    normalized.push({
      name: filename,
      content,
      contentType: attachment.contentType || 'application/octet-stream'
    });
  }

  return normalized;
}

function sendBrevoRequest(payload) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('BREVO_API_KEY missing'));
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(
      {
        hostname: 'api.brevo.com',
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body)
        }
      },
      (response) => {
        let responseBody = '';
        response.on('data', chunk => {
          responseBody += chunk;
        });
        response.on('end', () => {
          const parsed = responseBody ? JSON.parse(responseBody) : {};
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
            return;
          }

          const error = new Error(parsed?.message || `Brevo API failed with status ${response.statusCode}`);
          error.statusCode = response.statusCode;
          error.response = parsed;
          reject(error);
        });
      }
    );

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

async function sendBrevoEmailToRecipients({ recipients = [], subject, text, html, replyTo, attachments = [] }) {
  const sender = getSenderDetails();
  const normalizedRecipients = [...new Set(recipients
    .map(recipient => (typeof recipient === 'string' ? recipient.trim() : ''))
    .filter(isValidEmail))];

  if (!normalizedRecipients.length) {
    return 0;
  }

  const normalizedReplyTo = replyTo && isValidEmail(replyTo.email || replyTo)
    ? { email: (replyTo.email || replyTo).trim(), name: replyTo.name || undefined }
    : undefined;
  const normalizedAttachments = await normalizeAttachments(attachments);

  let sentCount = 0;
  for (const recipient of normalizedRecipients) {
    try {
      console.log(`Brevo email send attempt from ${sender.email} to ${recipient}`);
      await sendBrevoRequest({
        sender,
        to: [{ email: recipient }],
        subject,
        textContent: text,
        htmlContent: html,
        replyTo: normalizedReplyTo,
        attachment: normalizedAttachments.length ? normalizedAttachments : undefined
      });
      sentCount += 1;
    } catch (error) {
      console.error(`Error sending email from ${sender.email} to ${recipient}:`, error?.response || error);
      if (error?.statusCode) {
        console.error(`Brevo response status: ${error.statusCode}`);
      }
    }
  }

  return sentCount;
}

module.exports = {
  getSenderDetails,
  isValidEmail,
  sendBrevoEmailToRecipients
};