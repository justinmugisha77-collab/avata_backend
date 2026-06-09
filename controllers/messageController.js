const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { isValidEmail, sendBrevoEmailToRecipients } = require('../utils/brevoMailer');

function getAdminNotificationEmail() {
  return (process.env.ADMIN_NOTIFICATION_EMAIL || 'avatawebsite@gmail.com').trim();
}

async function sendContactEmailToAdmin({ name, email, phone, subject, message }) {
  try {
    const adminNotificationEmail = getAdminNotificationEmail();
    if (!process.env.BREVO_API_KEY) return false;
    if (!adminNotificationEmail) return false;

    const safeSubject = subject && String(subject).trim().length > 0 ? String(subject).trim() : 'Website Contact Message';

    const sentCount = await sendBrevoEmailToRecipients({
      recipients: [adminNotificationEmail],
      replyTo: isValidEmail(email) ? { email: email.trim(), name } : undefined,
      subject: `Contact: ${safeSubject}`,
      text: `New contact message\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nSubject: ${safeSubject}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
          <h2 style="margin: 0 0 10px;">New Contact Message</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
          <p><strong>Subject:</strong> ${safeSubject}</p>
          <p><strong>Message:</strong></p>
          <div style="padding: 10px; background: #f6f6f6; border-radius: 6px; white-space: pre-wrap;">${message}</div>
        </div>
      `
    });

    return sentCount > 0;
  } catch (error) {
    console.error('Error sending contact email:', error);
    return false;
  }
}

// Get all messages (admin only)
exports.getAllMessages = async (req, res) => {
  try {
    const messages = await Message.findAll();
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Get single message by ID (admin only)
exports.getMessageById = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ message });
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
};

// Create new message (public endpoint - no auth required)
exports.createMessage = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    console.log('Create message request body:', { name, email, phone, subject, message });

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const messageId = await Message.create({ name, email, phone, subject, message });

    try {
      const safeSubject = subject && String(subject).trim().length > 0 ? String(subject).trim() : 'No subject';
      const notifId = await Notification.create({
        user_id: null,
        message: `New Contact Us message from ${name} (${email}) - ${safeSubject}`,
        type: 'message',
        link: '/messages'
      });
      console.log(`✓ Contact message notification created: ID ${notifId}`);
    } catch (nErr) {
      console.error('❌ Failed to create contact notification:', nErr);
    }

    await sendContactEmailToAdmin({ name, email, phone, subject, message });
    res.status(201).json({ 
      message: 'Message sent successfully',
      id: messageId 
    });
  } catch (error) {
    console.error('Error creating message:', error && error.stack ? error.stack : error);
    // Provide error detail in development to assist debugging
    const details = process.env.NODE_ENV === 'production' ? undefined : (error && error.message ? error.message : undefined);
    res.status(500).json({ error: 'Failed to send message', details });
  }
};

// Delete message (admin only)
exports.deleteMessage = async (req, res) => {
  try {
    const success = await Message.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};
