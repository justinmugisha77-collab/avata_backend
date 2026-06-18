# Setting Up Admin and Owner Users

This guide will help you create admin and owner accounts in your database to access the Admin and Owner dashboards.

## Prerequisites

Make sure you have:
- MySQL database running
- Backend environment variables configured in `.env` file
- Node.js and npm installed

## Step 1: Configure Database Connection

Ensure your `.env` file in the `backend` folder has the correct database credentials:

```env
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=trade
```

## Step 2: Run the User Seed Script

Open a terminal in the `backend` folder and run:

```bash
cd backend
node seed_users.js
```

This script will:
- Create the `users` table if it doesn't exist
- Insert 3 test users (Admin, Owner, and Customer)
- Display all created users

## Step 3: Login Credentials

After running the seed script, you can use these credentials:

### Admin Dashboard
- **URL**: http://localhost:5173/admin
- **Email**: admin@avatatrading.com
- **Password**: Admin@123
- **Access**: Manage orders, view customers, contact via WhatsApp

### Owner Dashboard  
- **URL**: http://localhost:5173/owner
- **Email**: owner@avatatrading.com
- **Password**: Owner@123
- **Access**: View business metrics, revenue, profit, top products

### Test Customer Account
- **URL**: http://localhost:5173
- **Email**: customer@test.com
- **Password**: Customer@123
- **Access**: Regular customer shopping experience

## Alternative: Manual SQL Setup

If you prefer to run SQL commands directly, you can execute the SQL file:

```bash
mysql -u your_username -p trade < backend/setup_users.sql
```

Or copy/paste the SQL commands from `backend/setup_users.sql` into your MySQL client.

## Verification

To verify the users were created successfully:

```sql
SELECT id, full_name, email, role FROM users;
```

You should see three users with roles: admin, owner, and customer.

## Troubleshooting

### "Table doesn't exist" error
Run the seed script again - it will create the table automatically.

### "Duplicate entry" error
The users already exist in your database. You can either:
- Use the existing credentials
- Manually delete the users and run the script again:
  ```sql
  DELETE FROM users WHERE email IN ('admin@avatatrading.com', 'owner@avatatrading.com');
  ```

### Backend not connecting
- Check your `.env` file has correct database credentials
- Make sure MySQL is running
- Verify the database `trade` exists

## Security Note

⚠️ **Important**: These are test credentials with plain text passwords. In production:
- Implement password hashing (bcryptjs)
- Use JWT tokens for authentication
- Use environment variables for sensitive data
- Never commit credentials to version control

## Next Steps

1. Start the backend server: `cd backend && npm start`
2. Start the frontend: `cd frontend && npm run dev`
3. Login with admin/owner credentials
4. Access the respective dashboards

## Support

If you encounter any issues, check:
- Backend server is running on port 5000
- Frontend is running on port 5173
- MySQL database is accessible
- All npm packages are installed (`npm install`)
