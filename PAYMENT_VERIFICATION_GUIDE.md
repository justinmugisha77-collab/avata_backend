# Payment Verification System - Complete Guide

## Overview
This system implements a complete order management and payment verification workflow for AVATA Trading. It allows owners to manage orders, verify payments, and send notifications via WhatsApp or mark as submitted for customers without WhatsApp.

---

## Features Implemented

### 1. **Admin Capabilities**
- ✅ Create other admins
- ✅ Manage all users (create, edit, delete)
- ✅ Full system management access
- ✅ View all orders

### 2. **Owner Capabilities**
- ✅ View all customer orders
- ✅ See order details with payment tracking numbers
- ✅ Verify customer payments by uploading receipt/proof
- ✅ Send order confirmations via WhatsApp
- ✅ Mark orders as "Submitted" for customers without WhatsApp
- ✅ View payment proof submitted by customers
- ✅ Track sales history with verified payments
- ✅ Upload products (name, category, price, stock, image, description)

### 3. **Customer Capabilities**
- ✅ View order history
- ✅ See payment tracking numbers for each order
- ✅ Upload payment proof (receipt/screenshot)
- ✅ Track payment verification status
- ✅ Receive WhatsApp notifications when order is confirmed

---

## Payment Verification Workflow

### Step 1: Customer Places Order
1. Customer adds items to cart
2. Proceeds to checkout
3. Order is created with status: **"Pending Payment"**
4. System generates unique payment tracking number (e.g., `PAY-1708092345678`)

### Step 2: Customer Uploads Payment Proof
1. Customer goes to **Order History** page (`/orders`)
2. Clicks **"Upload Payment Proof"** button
3. Uploads payment receipt/screenshot to cloud (Google Drive, Dropbox, etc.)
4. Pastes image URL into the form
5. Submits payment proof
6. Order status changes to: **"Awaiting Verification"**

### Step 3: Owner Verifies Payment
1. Owner logs into **Owner Dashboard**
2. Navigates to **"Orders"** section
3. Sees all orders with payment status:
   - 🔴 **Pending Payment** - Customer hasn't uploaded proof
   - 🟡 **Awaiting Verification** - Customer uploaded proof, waiting for owner
   - 🟢 **Verified** - Owner confirmed payment
4. Clicks **"Verify"** button on orders awaiting verification
5. Reviews customer's payment proof
6. (Optional) Uploads owner's receipt/confirmation document
7. Clicks **"Verify Payment"**
8. Order status changes to: **"Confirmed"** and payment status to **"Verified"**

### Step 4: Owner Sends Order Confirmation
After verification, owner has two options:

**Option A: Send via WhatsApp** (for customers with phone numbers)
1. Clicks **"WhatsApp"** button
2. System opens WhatsApp Web with pre-filled message:
   ```
   Hello [Customer Name]!
   
   Your order #[Order ID] has been confirmed!
   Total: [Amount] RWF
   Payment Number: [Payment Number]
   
   Thank you for your order from AVATA Trading!
   ```
3. Order status changes to: **"Sent"**

**Option B: Mark as Submitted** (for customers without WhatsApp)
1. Clicks **"Submit"** button
2. Order status changes to: **"Submitted"**

### Step 5: Customer Tracks Order
1. Customer views **Order History**
2. Sees order status:
   - ✓ **Payment Verified by Owner** (green badge)
   - Verification date displayed
   - Owner's receipt visible (if uploaded)

---

## Database Schema Updates

Run this SQL to update your database:

```sql
-- Location: backend/migrations/update_orders_table.sql

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS items TEXT,
ADD COLUMN IF NOT EXISTS payment_status ENUM('pending', 'awaiting_verification', 'verified') DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_proof TEXT,
ADD COLUMN IF NOT EXISTS payment_receipt TEXT,
ADD COLUMN IF NOT EXISTS verified_at DATETIME;

ALTER TABLE orders 
MODIFY COLUMN status ENUM('pending', 'confirmed', 'processing', 'shipped', 'sent', 'submitted', 'completed', 'cancelled') DEFAULT 'pending';
```

---

## API Endpoints

### Orders Management

#### Create Order
```http
POST /api/orders
Content-Type: application/json

{
  "items": [...],
  "total_amount": 50000,
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "250788123456"
}
```

#### Get All Orders (Owner/Admin)
```http
GET /api/orders
Authorization: Bearer [token]
```

#### Get My Orders (Customer)
```http
GET /api/orders/myorders
Authorization: Bearer [token]
```

#### Submit Payment Proof (Customer)
```http
POST /api/orders/:id/payment-proof
Authorization: Bearer [token]
Content-Type: application/json

{
  "payment_proof": "https://drive.google.com/receipt.jpg"
}
```

#### Verify Payment (Owner)
```http
POST /api/orders/:id/verify-payment
Authorization: Bearer [token]
Content-Type: application/json

{
  "payment_receipt": "https://drive.google.com/owner-receipt.jpg"
}
```

#### Update Order Status (Owner)
```http
PUT /api/orders/:id/status
Authorization: Bearer [token]
Content-Type: application/json

{
  "status": "sent"
}
```

---

## Frontend Routes

| Route | Component | Access | Description |
|-------|-----------|--------|-------------|
| `/orders` | OrderHistory | Customer | View order history and upload payment proof |
| `/owner` | OwnerDashboard | Owner | Manage orders, verify payments, send WhatsApp |
| `/admin` | AdminDashboard | Admin | Manage users and system |

---

## How to Use

### For Customers:

1. **Place an Order**
   - Shop and add items to cart
   - Checkout with your details

2. **Make Payment**
   - Note the payment tracking number from your order
   - Make payment via bank transfer/mobile money
   - Take screenshot/photo of payment receipt

3. **Upload Payment Proof**
   - Click your profile icon → "Order History"
   - Find your order
   - Click "Upload Payment Proof"
   - Upload receipt to Google Drive/Dropbox (get shareable link)
   - Paste link and submit

4. **Wait for Verification**
   - Owner will verify your payment
   - You'll see "Payment Verified" status
   - You may receive WhatsApp confirmation

### For Owners:

1. **Access Orders**
   - Login with owner credentials
   - Navigate to "Orders" section

2. **Review Orders**
   - See all orders with payment status
   - Click "View Payment Proof" to review customer's receipt

3. **Verify Payment**
   - Click "Verify" button
   - Review payment details
   - (Optional) Upload your receipt/confirmation
   - Confirm verification

4. **Send Confirmation**
   - For customers with phone: Click "WhatsApp" to send message
   - For customers without phone: Click "Submit" to mark as submitted

### For Admins:

1. **Manage Users**
   - Login with admin credentials
   - Navigate to "User Management"
   - Create/edit/delete users (including other admins)

2. **View System Activity**
   - Access all dashboards
   - Monitor orders and sales
   - Manage entire system

---

## Payment Status Flow

```
Order Created
    ↓
[PENDING PAYMENT] 🔴
Customer hasn't uploaded proof
    ↓
Customer uploads payment proof
    ↓
[AWAITING VERIFICATION] 🟡
Waiting for owner to verify
    ↓
Owner verifies payment
    ↓
[VERIFIED] 🟢 → Order Status: CONFIRMED
    ↓
Owner sends via WhatsApp or marks as submitted
    ↓
[SENT/SUBMITTED] 🔵
Order complete
```

---

## Testing Instructions

### 1. Setup Database
```bash
cd backend
# Run the migration
mysql -u root -p avata_trading < migrations/update_orders_table.sql
```

### 2. Start Backend
```bash
cd backend
npm start
```

### 3. Start Frontend
```bash
cd frontend
npm run dev
```

### 4. Test Flow

**As Customer:**
1. Login as customer or register new account
2. Add products to cart → Checkout
3. Note payment number from confirmation
4. Go to "Order History" (profile menu)
5. Upload payment proof (use any image URL for testing)

**As Owner:**
1. Login with: `owner@avatatrading.com` / `Owner@123`
2. Go to "Orders" section
3. See order with "Awaiting Verification" status
4. Click "Verify" → Enter receipt URL (optional) → Verify
5. Click "WhatsApp" or "Submit" to complete

**As Admin:**
1. Login with: `admin@avatatrading.com` / `Admin@123`
2. Go to "User Management"
3. Create new admin/owner/customer
4. Edit/delete users

---

## WhatsApp Integration

The system uses WhatsApp Web API:
- Opens new tab with `https://wa.me/[phone]?text=[message]`
- Pre-fills message with order details
- Owner can customize message before sending
- Works with international phone numbers

**Phone Number Format:**
- Remove spaces and special characters
- Example: `250788123456` (Rwanda)
- System automatically formats the number

---

## Security Features

✅ **JWT Authentication** - All API endpoints protected  
✅ **Role-based Access** - Admin/Owner/Customer permissions  
✅ **Payment Verification** - Owner must manually verify payments  
✅ **Order History** - Customers only see their own orders  
✅ **Receipt Storage** - URLs for proof/receipts (not stored on server)  
✅ **Audit Trail** - Verification timestamps recorded  

---

## Fallback Mode

If backend is unavailable:
- ✅ Orders stored in localStorage
- ✅ Payment verification works locally
- ✅ Data persists in browser
- ⚠️ WhatsApp integration requires phone number
- ⚠️ Data not shared across devices

---

## Troubleshooting

### Issue: "No orders found"
- **Solution:** Make sure you're logged in with the correct account
- Orders are filtered by customer email

### Issue: Can't verify payment
- **Solution:** Check that you're logged in as owner
- Verify token is valid (try re-login)

### Issue: WhatsApp button doesn't work
- **Solution:** Customer must have phone number in order
- Phone number must be in correct format

### Issue: Payment proof not showing
- **Solution:** Image URL must be publicly accessible
- Try uploading to Google Drive and setting to "Anyone with link can view"

---

## Files Modified/Created

### Frontend
- ✅ `src/pages/OwnerDashboard.jsx` - Order management UI
- ✅ `src/pages/OrderHistory.jsx` - Customer order tracking (NEW)
- ✅ `src/components/Header.jsx` - Added order history link
- ✅ `src/App.jsx` - Added /orders route

### Backend
- ✅ `models/Order.js` - Payment verification fields
- ✅ `controllers/orderController.js` - Order management logic
- ✅ `routes/orderRoutes.js` - API endpoints
- ✅ `controllers/userController.js` - User management (NEW)
- ✅ `routes/userRoutes.js` - User API endpoints (NEW)
- ✅ `middleware/authMiddleware.js` - Admin/Owner middleware

### Database
- ✅ `migrations/update_orders_table.sql` - Schema updates (NEW)

---

## Support

For issues or questions:
1. Check console for errors (F12 in browser)
2. Verify database migrations ran successfully
3. Ensure backend is running on port 5000
4. Check network tab for failed API calls

---

**System Version:** 2.0  
**Last Updated:** February 2026  
**Status:** ✅ Production Ready
