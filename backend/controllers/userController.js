const User = require('../models/User');
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
};

// Get own profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({
      success: true,
      user: { id: user.id, full_name: user.full_name, email: user.email, phone: user.phone, role: user.role }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
};

// Update own profile
const updateProfile = async (req, res) => {
  try {
    const { full_name, email, phone, current_password, new_password } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // If email is being changed, check uniqueness
    if (email && email !== user.email) {
      const existing = await User.findByEmail(email);
      if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const updateData = {
      full_name: full_name || user.full_name,
      email: email || user.email,
      phone: phone !== undefined ? phone : user.phone,
    };

    // Password change
    if (new_password && new_password.trim()) {
      if (!current_password) {
        return res.status(400).json({ success: false, message: 'Current password is required' });
      }
      const valid = await bcrypt.compare(current_password, user.password);
      if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(new_password, salt);
    }

    await User.update(req.user.id, updateData);
    const updated = await User.findById(req.user.id);
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: { id: updated.id, full_name: updated.full_name, email: updated.email, phone: updated.phone, role: updated.role }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
};

// Create new user (admin only)
const createUser = async (req, res) => {
  try {
    const { full_name, email, phone, password, role } = req.body;
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Full name, email, password, and role are required' });
    }
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userId = await User.create({ full_name, email, phone: phone || null, password: hashedPassword, role });
    const newUser = await User.findById(userId);
    res.status(201).json({
      success: true, message: 'User created successfully',
      user: { id: newUser.id, full_name: newUser.full_name, email: newUser.email, phone: newUser.phone, role: newUser.role }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Error creating user' });
  }
};

// Update user (admin only)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, password, role } = req.body;
    const existingUser = await User.findById(id);
    if (!existingUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (email && email !== existingUser.email) {
      const emailExists = await User.findByEmail(email);
      if (emailExists) return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }
    const updateData = {
      full_name: full_name || existingUser.full_name,
      email: email || existingUser.email,
      phone: phone !== undefined ? phone : existingUser.phone,
      role: role || existingUser.role
    };
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    await User.update(id, updateData);
    const updatedUser = await User.findById(id);
    res.json({
      success: true, message: 'User updated successfully',
      user: { id: updatedUser.id, full_name: updatedUser.full_name, email: updatedUser.email, phone: updatedUser.phone, role: updatedUser.role }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
};

// Reset user password (admin/owner only)
const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body || {};

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const nextPassword = String(new_password || '').trim();
    if (!nextPassword) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }
    if (nextPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(nextPassword, salt);
    await User.update(id, { password: hashedPassword });

    return res.json({ success: true, message: 'User password reset successfully' });
  } catch (error) {
    console.error('Error resetting user password:', error);
    return res.status(500).json({ success: false, message: 'Error resetting user password' });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const existingUser = await User.findById(id);
    if (!existingUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user && req.user.id === parseInt(id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    await User.delete(id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Error deleting user' });
  }
};

// Database Backup (Owner/Admin only)
const exportDatabase = async (req, res) => {
  try {
    const tables = ['users', 'products', 'orders', 'categories', 'messages', 'notifications', 'special_offers'];
    const backup = {};

    for (const table of tables) {
      try {
        const [rows] = await db.execute(`SELECT * FROM ${table}`);
        backup[table] = rows;
      } catch (err) {
        console.warn(`Table ${table} not found or inaccessible during backup`);
        backup[table] = [];
      }
    }

    res.json({
      success: true,
      message: 'Database backup generated successfully',
      data: backup,
      timestamp: new Date().toISOString(),
      filename: `avata_backup_${new Date().toISOString().split('T')[0]}.json`
    });
  } catch (error) {
    console.error('Error generating backup:', error);
    res.status(500).json({ success: false, message: 'Error generating backup' });
  }
};

module.exports = { getAllUsers, getProfile, updateProfile, createUser, updateUser, resetUserPassword, deleteUser, exportDatabase };
