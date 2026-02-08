# DigitalShop - Complete Setup Guide

This guide will walk you through setting up DigitalShop from scratch on a fresh Windows machine with PostgreSQL 14+.

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Windows 10/11** (64-bit)
- [ ] **Node.js 22.x** installed ([Download](https://nodejs.org/))
- [ ] **PostgreSQL 14+** installed and running
- [ ] **Git** (optional, for version control)
- [ ] **VS Code** or your preferred code editor

---

## 🗄️ Step 1: Database Setup

### 1.1 Start PostgreSQL Service

```powershell
# Open PowerShell as Administrator
# Check if PostgreSQL is running
Get-Service -Name postgresql*

# If not running, start it
Start-Service postgresql-x64-14  # Adjust version number
```

### 1.2 Create Database

```powershell
# Set environment variable (temporary)
$env:PGPASSWORD='02102010'

# Create database
psql -U postgres -c "CREATE DATABASE digitalshop;"

# Verify creation
psql -U postgres -c "\l" | Select-String "digitalshop"
```

### 1.3 Apply Database Schema

```powershell
# Navigate to DigitalShop-Shared folder
cd "C:\Users\Chase\SimpleShopUG\DigitalShop-Shared\sql"

# Apply schema (creates core tables)
psql -U postgres -d digitalshop -f "01_schema.sql"

# Apply triggers (CRITICAL - includes tax calculation fix)
psql -U postgres -d digitalshop -f "02_triggers.sql"

# Optional: Apply seed data
psql -U postgres -d digitalshop -f "03_seed.sql"

# Apply additional migration scripts (REQUIRED for full functionality)
psql -U postgres -d digitalshop -f "04_add_pos_held_orders.sql"
psql -U postgres -d digitalshop -f "05_add_refunds_tables.sql"
psql -U postgres -d digitalshop -f "05_expenses.sql"
psql -U postgres -d digitalshop -f "05_rbac_roles_permissions.sql"
psql -U postgres -d digitalshop -f "06_system_settings.sql"
```

### 1.4 Verify Database

```powershell
# Check tables created
psql -U postgres -d digitalshop -c "\dt"

# Should show 20 tables:
# users, customers, customer_groups, suppliers, products,
# inventory_batches, cost_layers, pricing_tiers,
# purchase_orders, purchase_order_items,
# goods_receipts, goods_receipt_items,
# stock_movements, cash_registers, cash_register_sessions,
# cash_movements, sales, sale_items, invoices, invoice_payments
```

---

## 🖥️ Step 2: Backend Setup

### 2.1 Navigate to Backend

```powershell
cd "C:\Users\Chase\SimpleShopUG\DigitalShop-Backend"
```

### 2.2 Install Dependencies

```powershell
npm install
```

This will install:
- Express.js (web framework)
- PostgreSQL driver (pg)
- JWT authentication
- Zod validation
- Decimal.js (precision math)
- Winston logger
- And all other dependencies (~50 packages, takes 2-3 minutes)

### 2.3 Configure Environment

```powershell
# Copy example env file
Copy-Item .env.example .env

# Open .env in notepad
notepad .env
```

**Edit `.env` file - CRITICAL SETTINGS:**

```env
# Server
PORT=8340
NODE_ENV=development

# Database (MUST MATCH YOUR SETUP)
DATABASE_URL=postgresql://postgres:02102010@localhost:5432/digitalshop

# JWT (CHANGE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long-change-this
JWT_EXPIRES_IN=24h

# Frontend URL
FRONTEND_URL=http://localhost:5030
ALLOWED_ORIGINS=http://localhost:5030

# Tax
DEFAULT_TAX_RATE=0.06
```

**⚠️ SECURITY WARNING**: Change `JWT_SECRET` to a strong random string before production!

### 2.4 Start Backend Server

```powershell
npm run dev
```

**Expected output:**
```
✅ Database connected successfully
   Server time: 2026-01-29 10:00:00+03

✨ DigitalShop Backend Server
================================
🚀 Server running on port 8340
🌍 Environment: development
📡 API: http://localhost:8340/api
❤️  Health: http://localhost:8340/health
================================
```

### 2.5 Test Backend

Open new PowerShell window:

```powershell
# Test health endpoint
curl http://localhost:8340/health

# Expected response:
# {
#   "success": true,
#   "status": "healthy",
#   "database": "connected",
#   ...
# }
```

**✅ If you see this, backend is working!**

---

## 🎨 Step 3: Frontend Setup

### 3.1 Navigate to Frontend

```powershell
# Open NEW PowerShell window (keep backend running)
cd "C:\Users\Chase\SimpleShopUG\DigitalShop-Frontend"
```

### 3.2 Install Dependencies

```powershell
npm install
```

This will install:
- React 18
- Vite
- TanStack React Query
- Radix UI components
- Tailwind CSS
- And all dependencies (~100 packages, takes 3-5 minutes)

### 3.3 Configure Environment

```powershell
# Create .env file
New-Item -ItemType File -Path ".env" -Force

# Open in notepad
notepad .env
```

**Add to `.env`:**

```env
VITE_API_URL=http://localhost:8340/api
VITE_APP_NAME=DigitalShop
```

### 3.4 Start Frontend Server

```powershell
npm run dev
```

**Expected output:**
```
  VITE v5.0.8  ready in 1234 ms

  ➜  Local:   http://localhost:5030/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### 3.5 Open Application

1. Open browser
2. Navigate to: `http://localhost:5030`
3. You should see DigitalShop loading screen

**✅ If you see this, frontend is working!**

---

## 🔐 Step 4: First Login

### 4.1 Default Admin Account

The database includes a default admin user:

```
Email: admin@digitalshop.com
Password: admin123
```

### 4.2 Login

1. Navigate to `http://localhost:5030`
2. Click "Login" or navigate to login page
3. Enter credentials above
4. You should be redirected to dashboard

**⚠️ SECURITY**: Change admin password immediately after first login!

---

## 🧪 Step 5: Test the System

### 5.1 Test POS Module

1. Click "POS" in navigation
2. Add a product to cart
3. Complete a sale
4. Verify receipt prints

### 5.2 Test Inventory Module

1. Click "Inventory" in navigation
2. View inventory batches
3. Check FEFO allocation
4. Verify stock levels update

### 5.3 Test Reports Module

1. Click "Reports" in navigation
2. Generate a sales report
3. Export to PDF/CSV
4. Verify data accuracy

---

## 🐛 Troubleshooting

### Backend won't start

**Error**: `Database connection failed`
- Check PostgreSQL is running: `Get-Service postgresql*`
- Verify DATABASE_URL in `.env`
- Check password is correct: `02102010`
- Verify database exists: `psql -U postgres -l`

**Error**: `Port 8340 already in use`
- Kill existing process: `Get-Process -Id (Get-NetTCPConnection -LocalPort 8340).OwningProcess | Stop-Process`
- Or change PORT in `.env`

### Frontend won't start

**Error**: `Port 5030 already in use`
- Kill existing process: `Get-Process -Id (Get-NetTCPConnection -LocalPort 5030).OwningProcess | Stop-Process`
- Or change port in `vite.config.ts`

**Error**: `Failed to fetch`
- Check backend is running on port 8340
- Verify VITE_API_URL in `.env`
- Check browser console for CORS errors

### Database errors

**Error**: `relation "sales" does not exist`
- Schema not applied: Re-run `01_schema.sql`

**Error**: `function fn_update_sale_totals_internal does not exist`
- Triggers not applied: Re-run `02_triggers.sql`

**Error**: `Sale total validation failed`
- OLD BUG - Should be fixed by triggers
- Verify `02_triggers.sql` was applied (includes tax fix)

---

## 📊 Step 6: Verify Installation

### 6.1 Database Health Check

```powershell
$env:PGPASSWORD='02102010'

# Check tables
psql -U postgres -d digitalshop -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
# Should return: 20

# Check triggers
psql -U postgres -d digitalshop -c "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='public';"
# Should return: 12+

# Check default data
psql -U postgres -d digitalshop -c "SELECT email FROM users WHERE role='ADMIN';"
# Should return: admin@digitalshop.com
```

### 6.2 Backend Health Check

```powershell
curl http://localhost:8340/health | ConvertFrom-Json | Format-List

# Should show:
# success   : True
# status    : healthy
# database  : connected
```

### 6.3 Frontend Health Check

Open browser to `http://localhost:5030`
- Page loads ✅
- No console errors ✅
- Can navigate between pages ✅

---

## 🚀 Step 7: Production Deployment (Optional)

### 7.1 Backend Production

```powershell
cd "C:\Users\Chase\SimpleShopUG\DigitalShop-Backend"

# Build
npm run build

# Start production server
$env:NODE_ENV='production'
npm start
```

### 7.2 Frontend Production

```powershell
cd "C:\Users\Chase\SimpleShopUG\DigitalShop-Frontend"

# Build
npm run build

# Serve dist/ folder with your web server
# (IIS, nginx, Apache, etc.)
```

---

## 📝 Next Steps

After successful setup:

1. **Change default passwords**
   - Admin user password
   - Database password (if needed)

2. **Add your data**
   - Create products
   - Add customers
   - Configure cash registers
   - Set up suppliers

3. **Configure settings**
   - Tax rates
   - Currency format
   - Receipt template
   - Company information

4. **Train users**
   - Create user accounts
   - Assign roles
   - Demonstrate workflows

5. **Backup regularly**
   ```powershell
   pg_dump -U postgres -d digitalshop > backup_$(Get-Date -Format 'yyyyMMdd').sql
   ```

---

## 📖 Additional Resources

- **API Documentation**: See `API.md`
- **User Guide**: See `USER_GUIDE.md`
- **Database Schema**: See `DATABASE_SCHEMA.md`
- **Backend README**: `DigitalShop-Backend/README.md`
- **Frontend README**: `DigitalShop-Frontend/README.md`

---

## ❓ Getting Help

If you encounter issues:

1. Check logs:
   - Backend: `DigitalShop-Backend/logs/error.log`
   - Frontend: Browser console (F12)

2. Check database:
   ```powershell
   psql -U postgres -d digitalshop
   ```

3. Verify all services running:
   - PostgreSQL service
   - Backend (port 8340)
   - Frontend (port 5030)

---

## ✅ Setup Complete!

If you've reached this point successfully:

- ✅ Database created with 20 tables
- ✅ Backend running on port 8340
- ✅ Frontend running on port 5030
- ✅ Can login as admin
- ✅ All modules accessible

**🎉 Congratulations! DigitalShop is ready to use!**

---

**Last Updated**: January 29, 2026
**Version**: 1.0.0
