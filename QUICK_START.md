# Quick Start Guide

## ⚡ Quick Commands

### 1. Database Setup (Already Done ✅)
```bash
cd backend
node migrate_messages.js  # Creates messages table
node seed_messages.js      # Adds sample messages
```

### 2. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
node server.js
```
Expected output: `Server running on port 5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Expected output: `Local: http://localhost:5173/`

### 3. Login
Go to: http://localhost:5173

**Admin Credentials:**
- Email: `admin@avatatrading.com`
- Password: `Admin@123`

## 📋 Admin Dashboard Features

### Sidebar Navigation
- 📊 **Dashboard** - Overview
- 👥 **Users** - Create/edit users (including admin users)
- 🛍️ **Products** - Manage products with images
- 📁 **Categories** - Manage product categories
- 📋 **Orders** - View and update order status (NEW!)
- 💬 **Messages** - View customer support messages (NEW!)

### Create New Admin User
1. Click "Users"
2. Click "Add New User"
3. Fill details
4. **Role**: Select "admin"
5. Click "Create User"

### Manage Orders
1. Click "Orders"
2. View all orders
3. Update status:
   - Mark Pending (Yellow)
   - Mark Processing (Blue)
   - Mark Completed (Green)
   - Cancel Order (Red)

### View Messages
1. Click "Messages"
2. See all customer support messages
3. View customer info and message content

## 🔧 Troubleshooting

**Backend won't start?**
```bash
cd backend
npm install
```

**Frontend won't start?**
```bash
cd frontend
npm install
```

**Orders not showing?**
- Orders come from customer purchases
- Check database: `SELECT * FROM orders;`

**Messages not showing?**
- Run: `node migrate_messages.js`
- Run: `node seed_messages.js`
- Restart backend server

**Can't login?**
- Clear browser localStorage
- Use test-token.html to clear old tokens
- Try: admin@avatatrading.com / Admin@123

## 📝 Key Files

**Setup Guides:**
- `ADMIN_DASHBOARD_SETUP.md` - Detailed setup guide
- `IMPLEMENTATION_SUMMARY.md` - What was built
- `QUICK_START.md` - This file

**Backend (Important):**
- `backend/server.js` - Main backend server
- `backend/controllers/messageController.js` - Messages logic
- `backend/migrate_messages.js` - Database setup
- `backend/seed_messages.js` - Sample data

**Frontend (Important):**
- `frontend/src/pages/AdminDashboard.jsx` - Main dashboard

## ✅ What's Working

✅ Multi-image upload for products (up to 10 images)
✅ Image slider on product detail pages
✅ Category management (CRUD)
✅ User management with role selection
✅ Product management
✅ **Orders management with status updates** (NEW!)
✅ **Customer messages viewing** (NEW!)
✅ Password hashing with bcrypt
✅ JWT authentication
✅ Role-based access control

## 🎯 Everything You Requested

Your request:
> "help me to ad new usr use amdin role can working adn add product and add categories and ad sidebard in admin dashboard for manager oders and where se conatc usupport message"

**Status: ✅ COMPLETE**

1. ✅ Create users with admin role - Works in Users section
2. ✅ Add products - Works with multi-image upload
3. ✅ Create categories - Works with full CRUD
4. ✅ Sidebar for orders management - NEW Orders section
5. ✅ View customer support messages - NEW Messages section

Everything is ready to use! 🚀
