const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendBrevoEmailToRecipients } = require('../utils/brevoMailer');

const RESET_TOKEN_TTL_MINUTES = 60;

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            role: user.role 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '30d' }
    );
};

exports.registerUser = async (req, res) => {
    try {
        const { full_name, phone, email, password, role } = req.body;
        // Check if user exists
        const userExists = await User.findByEmail(email);
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userId = await User.create({
            full_name,
            phone,
            email,
            password: hashedPassword,
            role: role || 'customer'
        });

        // Fetch the created user
        const user = await User.findById(userId);

        // Return user data without password
        const userData = {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone,
            role: user.role
        };

        res.status(201).json({ 
            success: true,
            message: 'User registered successfully', 
            user: userData,
            token: generateToken(user)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        // Return user data without password
        const userData = {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone,
            role: user.role
        };

        res.status(200).json({
            success: true,
            message: 'Login successful',
            user: userData,
            token: generateToken(user)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const email = req.body?.email?.trim();

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const user = await User.findByEmail(email);
        if (user) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

            await User.setPasswordResetToken(user.id, hashedToken, expiresAt);

            const frontendBaseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
            const resetLink = `${frontendBaseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

            const html = `
              <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
                <h2 style="margin-bottom: 8px; color: #111827;">Reset your password</h2>
                <p>We received a request to reset your AVATA Trading account password.</p>
                <p>
                  <a href="${resetLink}" style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                    Reset Password
                  </a>
                </p>
                <p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>
                <p>If you did not request this, you can ignore this email.</p>
              </div>
            `;

            await sendBrevoEmailToRecipients({
                recipients: [user.email],
                subject: 'AVATA Trading - Password Reset',
                text: `Reset your password using this link: ${resetLink}. This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.`,
                html
            });
        }

        return res.status(200).json({
            success: true,
            message: 'If that email exists in our system, a reset link has been sent.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Failed to process forgot password request' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const token = req.body?.token?.trim();
        const password = req.body?.password;

        if (!token || !password) {
            return res.status(400).json({ success: false, message: 'Token and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findByResetToken(hashedToken);

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await User.updatePasswordById(user.id, hashedPassword);
        await User.clearPasswordResetToken(user.id);

        return res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
};

