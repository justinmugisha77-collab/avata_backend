const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user?.role === 'owner' || req.user?.role === 'admin' ? null : req.user?.id;
        const notifications = await Notification.findAllForUser(userId);
        res.json({ 
            success: true, 
            notifications: Array.isArray(notifications) ? notifications : [],
            count: Array.isArray(notifications) ? notifications.length : 0
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Error fetching notifications' });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        await Notification.markAsRead(req.params.id);
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating notification' });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        await Notification.delete(req.params.id);
        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting notification' });
    }
};
