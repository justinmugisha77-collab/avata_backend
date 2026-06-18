# Brevo Email Setup Guide for AVATA Trading

## Overview
Your order management system now uses **Brevo** (formerly Sendinblue) to send professional order confirmation emails with PDF receipts attached.

## Why Brevo?
- ✅ **Free tier**: 300 emails/day free
- ✅ **Reliable delivery**: Professional SMTP service
- ✅ **Easy setup**: Simple API key authentication
- ✅ **Professional emails**: No spam folder issues
- ✅ **Tracking**: Email open and click tracking

## Setup Instructions

### Step 1: Create a Brevo Account
1. Go to [https://www.brevo.com](https://www.brevo.com)
2. Click **"Sign up free"**
3. Fill in your details:
   - Email address
   - Company name: **AVATA Trading**
   - Password
4. Verify your email address

### Step 2: Get Your SMTP API Key
1. Log in to your Brevo account
2. Go to **Settings** → **SMTP & API** → **API Keys**
   - Direct link: [https://app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api)
3. Click **"Create a new API key"**
4. Name it: `AVATA Trading Orders`
5. **Copy the API key** (you won't see it again!)

### Step 3: Configure Your Application
1. Open `backend/.env` file
2. Update these values:
   ```env
   BREVO_API_KEY=xkeysib-YOUR_ACTUAL_API_KEY_HERE
   FROM_EMAIL=noreply@avatrading.com
   FROM_NAME=AVATA Trading
   ```

### Step 4: Verify Sender Email (Important!)
Brevo requires you to verify the sender email address:

1. Go to **Senders** → **Senders & IP**
   - Direct link: [https://app.brevo.com/senders](https://app.brevo.com/senders)
2. Click **"Add a sender"**
3. Enter your email details:
   - **Email**: noreply@avatrading.com (or your actual domain email)
   - **Name**: AVATA Trading
4. Brevo will send a verification email to this address
5. Click the verification link in that email

**Note**: If you don't have a custom domain email yet, you can use a Gmail/Yahoo address for testing:
   ```env
   FROM_EMAIL=your-gmail@gmail.com
   FROM_NAME=AVATA Trading
   ```

### Step 5: Test Your Setup
1. Start your backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Create a test order through your application
3. Check your customer email inbox for the confirmation email
4. Verify the PDF receipt is attached

## Email Features

### What Gets Sent
When an order is created, customers receive:
- ✉️ **Professional HTML email** with AVATA Trading branding
- 📋 **Order details**: ID, items, quantities, prices, total
- 📄 **PDF receipt attachment**: Downloadable invoice
- 📦 **Delivery information**: Phone, email, status
- 💳 **Payment status**: Verified or pending

### Email Design
- Gradient header with AVATA Trading logo
- Responsive design (mobile-friendly)
- Clean table layout for order items
- Clear call-to-action messages
- Professional footer with branding

## Troubleshooting

### Issue: "BREVO_API_KEY missing" Warning
**Solution**: Make sure your API key is correctly set in `.env` file without spaces or quotes.
```env
# ✅ Correct
BREVO_API_KEY=xkeysib-abc123...

# ❌ Wrong
BREVO_API_KEY="xkeysib-abc123..."
BREVO_API_KEY = xkeysib-abc123...
```

### Issue: Emails Not Being Sent
**Check these**:
1. Verify your sender email in Brevo dashboard
2. Check your API key is valid (not expired)
3. Ensure you haven't exceeded daily limit (300 emails/day on free tier)
4. Check backend console logs for error messages
5. Verify `customer_email` exists in order data

### Issue: Emails Going to Spam
**Solutions**:
1. Verify your sender domain in Brevo (SPF/DKIM records)
2. Use a custom domain email instead of Gmail/Yahoo
3. Warm up your email account (send gradually increasing volumes)
4. Check content doesn't trigger spam filters

### Issue: PDF Not Attached
**Check**:
1. Receipt file exists in `backend/uploads/receipts/` folder
2. PDF generation didn't fail (check console logs)
3. File permissions allow reading

## Free Tier Limits
- **300 emails per day** (free)
- **Unlimited contacts**
- **Email tracking included**

Need more? Upgrade to premium plans starting at $25/month for 20,000 emails/month.

## Advanced Configuration

### Custom Domain Setup
For production, set up a custom domain:

1. In Brevo, go to **Senders** → **Domains**
2. Add your domain: `avatrading.com`
3. Add DNS records (SPF, DKIM, MX) provided by Brevo
4. Wait for verification (can take up to 48 hours)
5. Update `.env`:
   ```env
   FROM_EMAIL=orders@avatrading.com
   ```

### Email Templates
The email template is in `backend/controllers/orderController.js` in the `sendOrderEmail()` function. You can customize:
- Colors and branding
- Header/footer content
- Order details layout
- Additional information sections

## Support
- **Brevo Documentation**: [https://developers.brevo.com/](https://developers.brevo.com/)
- **Brevo Support**: [https://help.brevo.com/](https://help.brevo.com/)
- **SMTP Guide**: [https://developers.brevo.com/docs/send-a-smtp-email](https://developers.brevo.com/docs/send-a-smtp-email)

## Security Notes
- ⚠️ **Never commit your API key** to version control
- ⚠️ Keep `.env` file private and secure
- ⚠️ Use environment-specific API keys (test vs production)
- ⚠️ Rotate API keys periodically for security

---

**Ready to send professional order emails! 📧**
