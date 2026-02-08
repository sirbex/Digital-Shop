# DigitalShop - User Guide

Complete guide to using all modules in DigitalShop.

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [POS Module](#pos-module)
3. [Inventory Module](#inventory-module)
4. [Purchase Orders Module](#purchase-orders-module)
5. [Customers Module](#customers-module)
6. [Suppliers Module](#suppliers-module)
7. [Reports Module](#reports-module)
8. [User Management](#user-management)
9. [Cash Register Management](#cash-register-management)
10. [Tips & Best Practices](#tips--best-practices)

---

## 🚀 Getting Started

### First Login

1. Navigate to `http://localhost:5030`
2. Click **Login**
3. Enter default credentials:
   - Email: `admin@digitalshop.com`
   - Password: `admin123`
4. **Important**: Change password immediately!

### Dashboard Overview

After login, you'll see:
- **Quick Stats**: Today's sales, inventory value, low stock alerts
- **Recent Transactions**: Latest sales and purchases
- **Navigation Menu**: Access to all modules
- **User Profile**: Your account settings

### User Roles

| Role | Permissions |
|------|-------------|
| **ADMIN** | Full system access, user management, settings |
| **MANAGER** | All operations except user management |
| **CASHIER** | POS, view inventory, basic reports |
| **STAFF** | View-only access, limited reporting |

---

## 🛒 POS Module

### Making a Sale

#### Step 1: Search for Products

1. Click **POS** in navigation
2. Use search bar to find products:
   - Type product name, SKU, or barcode
   - Press **Enter** or click product card
3. **Keyboard Shortcut**: `Ctrl+F` to focus search

#### Step 2: Add Items to Cart

**Option A: Click Product Card**
- Click product in search results
- Item added with quantity 1

**Option B: Scan Barcode**
- Focus search bar
- Scan barcode with scanner
- Item added automatically

**Option C: Manual Entry**
- Type SKU/barcode in search
- Press Enter
- Item added to cart

**Adjust Quantity**:
- Click quantity field in cart
- Type new quantity
- Press Enter

**Change Price** (Manager/Admin only):
- Click price field
- Enter discounted price
- System calculates new total

#### Step 3: Select Customer (Optional)

1. Click **Select Customer** button
2. Search customer by name or phone
3. Click customer name
4. Customer balance displayed if credit

#### Step 4: Process Payment

1. Review cart totals:
   - **Subtotal**: Before tax
   - **Tax**: Calculated automatically
   - **Total**: Final amount
2. Click **Pay** button (`Ctrl+Enter`)
3. **Payment Modal** appears

**Payment Methods**:

**CASH**:
1. Select "Cash" tab
2. Enter amount received
3. Change calculated automatically
4. Click **Complete Sale**

**CARD**:
1. Select "Card" tab
2. Process card payment on terminal
3. Click **Complete Sale**

**MOBILE MONEY**:
1. Select "Mobile Money" tab
2. Enter transaction reference
3. Click **Complete Sale**

**CREDIT** (Registered Customers):
1. Select "Credit" tab
2. Verify customer credit limit
3. Click **Complete Sale**
4. Balance updated automatically

#### Step 5: Print Receipt

After sale completion:
1. **Receipt Preview** appears
2. Click **Print** to print physical receipt
3. Click **Email** to send to customer
4. Click **Done** to return to POS

### Hold Cart Feature

**Save for Later**:
1. Build cart as normal
2. Click **Hold** button (`Ctrl+S`)
3. Enter hold name (e.g., "John's Order")
4. Cart saved to localStorage

**Recall Held Cart**:
1. Click **Recall** button (`Ctrl+R`)
2. Select cart from list
3. Cart loaded automatically
4. Continue transaction

**Clear Cart**:
- Click **Clear** button
- Confirm deletion
- Cart emptied

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Focus search bar |
| `Ctrl+Enter` | Open payment modal |
| `Ctrl+S` | Hold cart |
| `Ctrl+R` | Recall cart |
| `Esc` | Close modal |
| `Tab` | Navigate fields |

---

## 📦 Inventory Module

### Viewing Inventory

1. Click **Inventory** in navigation
2. **Inventory Table** shows:
   - Product name
   - SKU/Barcode
   - Quantity on hand
   - Total value
   - Status indicators

**Filters**:
- **Category**: Filter by product category
- **Low Stock**: Show items below reorder level
- **Expiring Soon**: Items expiring in next 30 days
- **Search**: Find by name, SKU, barcode

### Batch Management

**View Batches**:
1. Click product row
2. **Batch Details** drawer opens
3. See all batches for product:
   - Batch number
   - Quantity remaining
   - Expiry date
   - Cost price
   - Status

**Batch Statuses**:
- 🟢 **ACTIVE**: Available for sale
- 🟡 **EXPIRING**: Expires within 30 days
- 🔴 **EXPIRED**: Past expiry date
- ⚫ **DEPLETED**: Quantity = 0

### FEFO (First Expiry First Out)

**Automatic Batch Selection**:
- System automatically allocates batches
- Prioritizes earliest expiry dates
- Ensures stock rotation
- Reduces waste

**Manual Batch Selection** (Manager/Admin):
1. In POS, click item in cart
2. Click **Select Batch**
3. Choose specific batch
4. Confirm selection

### Stock Adjustments

**When to Adjust**:
- Physical count discrepancies
- Damaged goods
- Theft/loss
- Returns

**How to Adjust**:
1. Navigate to **Inventory** → **Adjustments**
2. Click **New Adjustment**
3. Search and select product
4. Select batch (if applicable)
5. Enter quantity:
   - **Positive number**: Add stock
   - **Negative number**: Remove stock
6. Select reason:
   - Damaged
   - Expired
   - Theft
   - Count correction
   - Other
7. Enter notes (required)
8. Click **Save Adjustment**

**Approval Required** (Manager/Admin):
- Adjustments create audit trail
- Large adjustments may require approval
- All changes logged in stock movements

### Stock Movements Report

**View History**:
1. Click **Inventory** → **Movements**
2. Filter by:
   - Date range
   - Product
   - Movement type
3. See complete audit trail

**Movement Types**:
- **SALE**: Stock sold
- **PURCHASE**: Stock received
- **ADJUSTMENT**: Manual adjustment
- **RETURN**: Customer return
- **TRANSFER**: Location transfer

---

## 📋 Purchase Orders Module

### Creating Purchase Order

#### Step 1: Start New PO

1. Navigate to **Purchases** → **Orders**
2. Click **New Purchase Order**
3. **PO Form** appears

#### Step 2: Select Supplier

1. Click **Select Supplier**
2. Search by name
3. Click supplier name
4. Supplier details populated

#### Step 3: Add Products

1. Click **Add Product**
2. Search product catalog
3. Enter:
   - **Quantity**: How many to order
   - **Unit Price**: Cost per unit
4. Click **Add to PO**
5. Repeat for all products

**Edit Line Items**:
- Change quantity/price inline
- Remove items with trash icon
- Total calculated automatically

#### Step 4: Review & Submit

1. Review PO details:
   - Supplier information
   - Line items
   - Total amount
2. Enter **Order Date**
3. Add **Notes** (optional)
4. Click **Save as Draft** or **Submit PO**

**PO Statuses**:
- **DRAFT**: Editable, not sent
- **PENDING**: Submitted, awaiting delivery
- **COMPLETED**: All items received
- **CANCELLED**: Order cancelled

### Receiving Goods (Goods Receipt)

#### Step 1: Start Goods Receipt

1. Navigate to **Purchases** → **Orders**
2. Find PO with status **PENDING**
3. Click **Receive Goods**
4. **GR Form** appears

#### Step 2: Enter Received Quantities

For each line item:
1. Enter **Received Quantity**
   - May differ from ordered (damages, shortages)
2. **Batch Information**:
   - **Batch Number**: Auto-generated or manual
   - **Expiry Date**: If product tracks expiry
   - **Cost Price**: Defaults to PO price, adjustable
3. Verify all entries

#### Step 3: Complete Receipt

1. Enter **Receipt Date**
2. Add **Notes** (document shortages, damages)
3. Click **Complete Receipt**

**System Actions**:
- ✅ Creates inventory batches
- ✅ Updates product quantities
- ✅ Updates cost layers (FIFO/AVCO)
- ✅ Logs stock movements
- ✅ Updates PO status
- ✅ Updates supplier balance

### Managing POs

**View All POs**:
- Filter by status
- Search by PO number
- Sort by date/amount

**Edit PO** (Draft only):
- Click PO row
- Modify details
- Save changes

**Cancel PO**:
- Click PO row
- Click **Cancel Order**
- Confirm cancellation
- Cannot cancel if partially received

---

## 👥 Customers Module

### Adding New Customer

1. Navigate to **Customers**
2. Click **New Customer**
3. Enter details:
   - **Name**: Required
   - **Email**: Optional
   - **Phone**: Optional but recommended
   - **Customer Group**: Retail, Wholesale, VIP, etc.
   - **Credit Limit**: Maximum credit allowed
   - **Address**: Delivery address
   - **Notes**: Internal notes
4. Click **Save Customer**

### Customer Groups

**Purpose**:
- Apply pricing tiers
- Set default credit limits
- Track customer segments

**Groups**:
- **Retail**: Walk-in customers
- **Wholesale**: Bulk buyers
- **VIP**: Special pricing

### Managing Customer Credit

**View Balance**:
1. Click customer row
2. **Customer Details** shows:
   - Current balance
   - Credit limit
   - Available credit

**Negative Balance** = Customer owes money

**Credit Sales**:
1. In POS, select customer
2. Choose "Credit" payment method
3. System verifies credit limit:
   - ✅ Allowed if within limit
   - ❌ Blocked if exceeds limit

**Record Payment**:
1. Navigate to **Customers**
2. Click customer with balance
3. Click **Record Payment**
4. Enter:
   - Amount received
   - Payment method
   - Reference number
   - Notes
5. Click **Save Payment**
6. Balance updated automatically

### Customer Transaction History

**View Transactions**:
1. Click customer row
2. Navigate to **Transactions** tab
3. See complete history:
   - Sales (increases balance)
   - Payments (decreases balance)
   - Running balance

**Export Transactions**:
- Click **Export**
- Choose PDF or CSV
- Customer statement generated

---

## 🏢 Suppliers Module

### Adding New Supplier

1. Navigate to **Suppliers**
2. Click **New Supplier**
3. Enter details:
   - **Name**: Required
   - **Contact Person**: Primary contact
   - **Email**: Required
   - **Phone**: Required
   - **Address**: Physical address
   - **Payment Terms**: Net 30, Net 60, etc.
   - **Notes**: Internal notes
4. Click **Save Supplier**

### Managing Supplier Balances

**Positive Balance** = We owe supplier money

**Balance Increases**:
- Goods receipts (purchase value)
- Credit purchases

**Balance Decreases**:
- Payments to supplier

### Recording Supplier Payments

1. Navigate to **Suppliers**
2. Click supplier with balance
3. Click **Record Payment**
4. Enter:
   - Amount paid
   - Payment method (Cash, Bank Transfer, etc.)
   - Reference number (check number, transaction ID)
   - Payment date
   - Notes
5. Click **Save Payment**
6. Balance updated automatically

### Supplier Performance

**View Metrics**:
1. Click supplier row
2. Navigate to **Performance** tab
3. See:
   - Total purchases (value)
   - Order count
   - Average order value
   - On-time delivery rate
   - Quality rating

---

## 📊 Reports Module

### Accessing Reports

1. Click **Reports** in navigation
2. **Report Categories**:
   - Sales Reports
   - Purchase Reports
   - Inventory Reports
   - Financial Reports
   - Customer Reports
   - Supplier Reports

### Sales Reports

#### Sales Summary

**Purpose**: Overview of sales performance

**Filters**:
- Date range (required)
- Payment method
- Customer group
- Cashier

**Metrics**:
- Total sales
- Total cost
- Gross profit
- Profit margin
- Transaction count
- Average transaction value
- Sales by payment method
- Daily breakdown

**Export Options**: PDF, CSV, Excel

#### Sales by Product

**Purpose**: Best/worst selling products

**Shows**:
- Product name
- Quantity sold
- Revenue
- Cost
- Profit
- Profit margin

**Sorting**:
- By revenue (top sellers)
- By quantity (most popular)
- By profit (most profitable)

#### Sales by Customer

**Purpose**: Top customers analysis

**Shows**:
- Customer name
- Total purchases
- Average transaction
- Last purchase date
- Lifetime value

### Inventory Reports

#### Inventory Valuation

**Purpose**: Current stock value

**Shows**:
- Product details
- Quantity on hand
- Average cost
- Total value
- Valuation method (FIFO/AVCO)

**Total Inventory Value**: Sum of all products

#### Stock Movement Report

**Purpose**: Track inventory changes

**Filters**:
- Date range
- Product
- Movement type

**Shows**:
- Movement number
- Date
- Product
- Quantity change
- Type (SALE, PURCHASE, ADJUSTMENT)
- Reference (sale/PO number)

#### Expiring Stock Report

**Purpose**: Identify items nearing expiry

**Shows**:
- Product name
- Batch number
- Quantity
- Expiry date
- Days until expiry

**Filter by**: 7 days, 30 days, 60 days, 90 days

#### Low Stock Report

**Purpose**: Reorder alerts

**Shows**:
- Products below reorder level
- Current quantity
- Reorder level
- Reorder quantity
- Days of stock remaining

### Financial Reports

#### Profit & Loss Statement

**Purpose**: Business profitability

**Period**: Month, Quarter, Year

**Sections**:
- **Revenue**: Total sales
- **Cost of Goods Sold**: Product costs
- **Gross Profit**: Revenue - COGS
- **Operating Expenses**: Salaries, rent, utilities
- **Net Profit**: Gross profit - expenses

#### Cash Flow Statement

**Purpose**: Track cash movements

**Categories**:
- **Operating Activities**: Sales, purchases
- **Investing Activities**: Equipment, assets
- **Financing Activities**: Loans, equity

### Purchase Reports

#### Purchase Summary

**Purpose**: Purchasing overview

**Shows**:
- Total purchases
- By supplier
- By product category
- Order count
- Average order value

#### Goods Receipt Report

**Purpose**: Receiving history

**Shows**:
- GR number
- Date received
- Supplier
- Total value
- Items received

### Customer Reports

#### Customer Statement

**Purpose**: Individual customer history

**Shows**:
- All transactions
- Sales
- Payments
- Running balance

**Use Case**: Send to customers for reconciliation

#### Customer Aging Report

**Purpose**: Outstanding balances by age

**Shows**:
- Customer name
- Current balance
- 0-30 days
- 31-60 days
- 61-90 days
- 90+ days

**Use Case**: Identify overdue accounts

### Report Features

#### Export Options

All reports support:
- **PDF**: Professional format, print-ready
- **CSV**: Import to Excel/spreadsheet
- **Excel**: Native .xlsx format

#### Scheduling (Future Feature)

- Email reports automatically
- Daily, weekly, monthly schedules
- Multiple recipients

#### Custom Date Ranges

- Today
- Yesterday
- This Week
- Last Week
- This Month
- Last Month
- This Year
- Custom Range

---

## 👤 User Management

**(Admin Only)**

### Adding Users

1. Navigate to **Settings** → **Users**
2. Click **New User**
3. Enter:
   - **Full Name**: Required
   - **Email**: Required, must be unique
   - **Password**: Minimum 8 characters
   - **Role**: ADMIN, MANAGER, CASHIER, STAFF
   - **Status**: Active/Inactive
4. Click **Save User**
5. User receives email with credentials

### Managing Users

**Edit User**:
1. Click user row
2. Update details
3. Save changes

**Deactivate User**:
1. Click user row
2. Toggle **Active** status
3. User cannot login when inactive

**Reset Password**:
1. Click user row
2. Click **Reset Password**
3. Temporary password generated
4. Send to user via email

### Role Permissions

| Permission | Admin | Manager | Cashier | Staff |
|------------|-------|---------|---------|-------|
| POS Sales | ✅ | ✅ | ✅ | ❌ |
| View Inventory | ✅ | ✅ | ✅ | ✅ |
| Adjust Stock | ✅ | ✅ | ❌ | ❌ |
| Create PO | ✅ | ✅ | ❌ | ❌ |
| Receive Goods | ✅ | ✅ | ❌ | ❌ |
| View Reports | ✅ | ✅ | ✅ | ✅ |
| Export Reports | ✅ | ✅ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ | ❌ |

---

## 💰 Cash Register Management

### Opening Cash Register

**Before Starting Sales**:

1. Navigate to **Cash Register**
2. Click **Open Session**
3. Enter:
   - **Register**: Select register
   - **Opening Float**: Starting cash amount
   - **Denomination Breakdown**:
     - Count each denomination
     - System calculates total
4. Verify total matches opening float
5. Click **Open Session**

**Session Number**: Auto-generated (e.g., CS-2026-00045)

### During Session

**Track All Cash Movements**:

**Float In/Out**:
- Adding cash to register
- Removing cash for safety

**Payouts**:
- Cash paid for expenses
- Supplier payments
- Petty cash

**Bank Deposits**:
- Cash taken to bank
- Reduces register balance

**Record Movement**:
1. Click **Cash Movement**
2. Select type
3. Enter amount
4. Enter description
5. Save movement

### Closing Cash Register

**End of Shift**:

1. Click **Close Session**
2. **Cash Count**:
   - Count physical cash
   - Enter denomination breakdown
   - System calculates total
3. **Comparison**:
   - **Expected**: Opening float + sales - movements
   - **Actual**: Physical count
   - **Variance**: Difference (overage/shortage)
4. **Summary**:
   - Total sales
   - Payment breakdown (cash, card, mobile)
   - Cash movements
   - Net cash
5. Review summary
6. Click **Close Session**

**Session Report**:
- Automatically generated
- Shows all transactions
- Variance explanation required if >1% of sales

### Session Reports

**View Past Sessions**:
1. Navigate to **Cash Register** → **History**
2. Filter by:
   - Date range
   - Register
   - Cashier
   - Status
3. Click session to view details

**Export Session**:
- PDF: Professional report
- CSV: Transaction details

---

## 💡 Tips & Best Practices

### POS Best Practices

1. **Always verify prices** before completing sale
2. **Count change carefully** for cash transactions
3. **Print receipts** for all transactions
4. **Hold carts** for interrupted sales
5. **Clear cart** after each sale

### Inventory Best Practices

1. **Regular physical counts** - Monthly or quarterly
2. **Immediate adjustments** - Document discrepancies
3. **Monitor expiry dates** - Run weekly reports
4. **FEFO compliance** - Trust automatic batch selection
5. **Reorder alerts** - Set appropriate reorder levels

### Purchase Order Best Practices

1. **Verify prices** before submitting PO
2. **Inspect goods** upon receipt
3. **Document discrepancies** in GR notes
4. **Batch numbers** - Use consistent format
5. **Expiry dates** - Enter accurately

### Customer Management Best Practices

1. **Credit limits** - Set conservatively
2. **Regular statements** - Monthly for credit customers
3. **Follow up** - On overdue accounts
4. **Update contacts** - Keep email/phone current
5. **Notes** - Document special requirements

### Financial Best Practices

1. **Daily reconciliation** - Review cash register sessions
2. **Regular reports** - Weekly sales summary
3. **Monitor margins** - Track profitability
4. **Expense tracking** - Record all outflows
5. **Backup data** - Daily database backups

### Security Best Practices

1. **Strong passwords** - Minimum 12 characters
2. **Change defaults** - Admin password first thing
3. **Role separation** - Appropriate permissions
4. **Logout** - When leaving workstation
5. **Audit logs** - Review regularly

---

## 🆘 Common Issues & Solutions

### Cannot Login

**Issue**: Invalid credentials
**Solution**: 
- Verify email/password
- Check Caps Lock
- Contact admin for reset

### Sale Fails to Complete

**Issue**: Insufficient stock
**Solution**:
- Check inventory levels
- Verify batch quantities
- Adjust sale quantities

**Issue**: Customer credit limit exceeded
**Solution**:
- Request payment
- Adjust credit limit (Manager)
- Split payment methods

### Inventory Discrepancy

**Issue**: Physical count differs
**Solution**:
- Create stock adjustment
- Document reason
- Investigate cause

### Cash Register Variance

**Issue**: Cash shortage/overage
**Solution**:
- Recount physical cash
- Review transaction log
- Document in closing notes
- Investigate if variance >1%

### Report Not Loading

**Issue**: Date range too large
**Solution**:
- Reduce date range
- Filter by specific criteria
- Export in batches

---

## 📱 Mobile Access (Future Feature)

DigitalShop will support:
- Mobile POS
- Inventory checks
- Quick reports
- Customer lookup

Stay tuned for updates!

---

## 🔄 System Updates

**Automatic Updates**:
- Features added regularly
- Security patches applied
- Performance improvements

**Change Log**:
- Check **Settings** → **About** for version history

---

## 📞 Support

Need help?

1. **User Guide** (this document)
2. **API Documentation** (API.md)
3. **Database Schema** (DATABASE_SCHEMA.md)
4. **Contact Admin** - admin@digitalshop.com

---

**Happy Selling! 🎉**

---

**Last Updated**: January 29, 2026
**Version**: 1.0.0
