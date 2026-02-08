# DigitalShop - Database Schema Documentation

Complete reference for the PostgreSQL database schema.

---

## 📊 Overview

**Database Name**: `digitalshop`
**PostgreSQL Version**: 14+
**Total Tables**: 20
**Custom Types (ENUMs)**: 11
**Triggers**: 8
**Indexes**: 25+

---

## 🎯 Entity Relationship Overview

```
┌─────────────────┐
│     USERS       │
│  (employees)    │
└────────┬────────┘
         │
         ├─── manages ───► CASH_REGISTER_SESSIONS
         ├─── creates ───► SALES
         └─── creates ───► PURCHASE_ORDERS

┌──────────────────┐
│   CUSTOMERS      │
│  (buyers)        │
└────────┬─────────┘
         │
         ├─── has ───► CUSTOMER_GROUPS
         ├─── places ───► SALES
         └─── owes ───► INVOICES

┌──────────────────┐
│   SUPPLIERS      │
│  (vendors)       │
└────────┬─────────┘
         │
         └─── fulfills ───► PURCHASE_ORDERS

┌──────────────────┐
│    PRODUCTS      │
│  (catalog)       │
└────────┬─────────┘
         │
         ├─── has ───► INVENTORY_BATCHES
         ├─── has ───► COST_LAYERS
         ├─── has ───► PRICING_TIERS
         ├─── in ───► SALE_ITEMS
         └─── in ───► PURCHASE_ORDER_ITEMS

┌──────────────────┐
│ PURCHASE_ORDERS  │
│  (POs)           │
└────────┬─────────┘
         │
         ├─── has ───► PURCHASE_ORDER_ITEMS
         └─── received_via ───► GOODS_RECEIPTS

┌──────────────────┐
│  GOODS_RECEIPTS  │
│  (GRs)           │
└────────┬─────────┘
         │
         ├─── has ───► GOODS_RECEIPT_ITEMS
         └─── creates ───► INVENTORY_BATCHES

┌──────────────────┐
│     SALES        │
│  (transactions)  │
└────────┬─────────┘
         │
         ├─── has ───► SALE_ITEMS
         ├─── creates ───► INVOICES (if credit)
         └─── in ───► CASH_REGISTER_SESSIONS

┌──────────────────┐
│ CASH_REGISTERS   │
│  (tills)         │
└────────┬─────────┘
         │
         ├─── has ───► CASH_REGISTER_SESSIONS
         └─── tracks ───► CASH_MOVEMENTS
```

---

## 📋 Table Definitions

### 1. users

**Purpose**: System users (employees, admins, cashiers)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'STAFF',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `id` - Unique identifier (UUID)
- `email` - Login email (unique)
- `password_hash` - Bcrypt hashed password
- `full_name` - Display name
- `role` - ADMIN, MANAGER, CASHIER, STAFF
- `is_active` - Account status
- `created_at` - Registration timestamp
- `updated_at` - Last modification timestamp

**Indexes**:
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**Seed Data**:
- 1 admin user: `admin@digitalshop.com` / `admin123`

---

### 2. customer_groups

**Purpose**: Customer segmentation for pricing tiers

```sql
CREATE TABLE customer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `id` - Unique identifier
- `name` - Group name (e.g., "Retail", "Wholesale")
- `description` - Optional description
- `discount_percentage` - Default discount (0-100)
- `is_active` - Group status

**Seed Data**:
- Retail (0% discount)
- Wholesale (15% discount)

---

### 3. customers

**Purpose**: Customer records with credit tracking

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  customer_group_id UUID REFERENCES customer_groups(id),
  balance NUMERIC(15,2) DEFAULT 0,
  credit_limit NUMERIC(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `balance` - Current balance (negative = owes money)
- `credit_limit` - Maximum credit allowed
- `customer_group_id` - Link to pricing tier

**Indexes**:
```sql
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_group ON customers(customer_group_id);
```

**Business Rules**:
- Negative balance = customer owes money
- Cannot exceed credit_limit
- Balance auto-updated by triggers

---

### 4. suppliers

**Purpose**: Supplier records with payable tracking

```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  payment_terms VARCHAR(100),
  balance NUMERIC(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `balance` - Current balance (positive = we owe money)
- `payment_terms` - e.g., "Net 30", "Net 60"

**Indexes**:
```sql
CREATE INDEX idx_suppliers_name ON suppliers(name);
```

**Business Rules**:
- Positive balance = we owe supplier
- Balance auto-updated by triggers

---

### 5. products

**Purpose**: Product catalog with costing configuration

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  barcode VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  cost_price NUMERIC(15,2) NOT NULL,
  selling_price NUMERIC(15,2) NOT NULL,
  costing_method costing_method DEFAULT 'FIFO',
  quantity_on_hand INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 0,
  reorder_quantity INTEGER DEFAULT 0,
  track_expiry BOOLEAN DEFAULT false,
  is_taxable BOOLEAN DEFAULT true,
  tax_rate NUMERIC(5,4) DEFAULT 0.06,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `sku` - Stock Keeping Unit (unique)
- `barcode` - Barcode/QR code (unique, optional)
- `cost_price` - Purchase cost
- `selling_price` - Retail price
- `costing_method` - FIFO or AVCO
- `quantity_on_hand` - Total stock (auto-calculated)
- `reorder_level` - Low stock threshold
- `track_expiry` - Enable batch expiry tracking
- `tax_rate` - Product-specific tax (default 6%)

**Indexes**:
```sql
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);
```

**Business Rules**:
- `quantity_on_hand` auto-updated by trigger
- If `track_expiry=true`, must specify expiry on receipt

---

### 6. inventory_batches

**Purpose**: Batch/lot tracking with FEFO allocation

```sql
CREATE TABLE inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number VARCHAR(100) UNIQUE NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  cost_price NUMERIC(15,2) NOT NULL,
  expiry_date DATE,
  status batch_status DEFAULT 'ACTIVE',
  received_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `batch_number` - Unique identifier (e.g., "BATCH-2026-001")
- `quantity` - Original quantity
- `remaining_quantity` - Current stock
- `status` - ACTIVE, DEPLETED, EXPIRED, DAMAGED
- `expiry_date` - Optional expiry date

**Indexes**:
```sql
CREATE INDEX idx_batches_product ON inventory_batches(product_id);
CREATE INDEX idx_batches_expiry ON inventory_batches(expiry_date);
CREATE INDEX idx_batches_status ON inventory_batches(status);
CREATE INDEX idx_batches_fefo ON inventory_batches(product_id, expiry_date, remaining_quantity);
```

**Business Rules**:
- FEFO allocation: Earliest expiry first
- Status auto-updated:
  - EXPIRED if expiry_date < today
  - DEPLETED if remaining_quantity = 0

---

### 7. cost_layers

**Purpose**: FIFO/AVCO cost calculation layers

```sql
CREATE TABLE cost_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  unit_cost NUMERIC(15,2) NOT NULL,
  received_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `unit_cost` - Cost per unit for this layer
- `remaining_quantity` - Units not yet sold
- `is_active` - Layer depleted when false

**Indexes**:
```sql
CREATE INDEX idx_cost_layers_product ON cost_layers(product_id);
CREATE INDEX idx_cost_layers_fifo ON cost_layers(product_id, received_date);
```

**Business Rules**:
- New layer created on each goods receipt
- FIFO: Oldest layer consumed first
- AVCO: Weighted average calculated

---

### 8. pricing_tiers

**Purpose**: Customer group pricing (future feature)

```sql
CREATE TABLE pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  customer_group_id UUID NOT NULL REFERENCES customer_groups(id),
  price NUMERIC(15,2) NOT NULL,
  min_quantity INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, customer_group_id, min_quantity)
);
```

**Columns**:
- `price` - Special price for this tier
- `min_quantity` - Minimum order quantity

**Business Rules**:
- Applied automatically in POS if customer selected
- Quantity breaks supported

---

### 9. purchase_orders

**Purpose**: Purchase order header records

```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  status purchase_order_status DEFAULT 'DRAFT',
  total_amount NUMERIC(15,2) DEFAULT 0,
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `order_number` - Auto-generated (PO-YYYY-####)
- `status` - DRAFT, PENDING, COMPLETED, CANCELLED
- `total_amount` - Auto-calculated from line items

**Indexes**:
```sql
CREATE INDEX idx_po_number ON purchase_orders(order_number);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
```

**Business Rules**:
- Status progression: DRAFT → PENDING → COMPLETED
- Cannot edit after PENDING (except cancel)

---

### 10. purchase_order_items

**Purpose**: Purchase order line items

```sql
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  ordered_quantity INTEGER NOT NULL,
  received_quantity INTEGER DEFAULT 0,
  unit_price NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `ordered_quantity` - Quantity ordered
- `received_quantity` - Quantity received (updated on GR)
- `unit_price` - Cost per unit

**Indexes**:
```sql
CREATE INDEX idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_po_items_product ON purchase_order_items(product_id);
```

**Business Rules**:
- `received_quantity` incremented on goods receipt
- PO COMPLETED when all items fully received

---

### 11. goods_receipts

**Purpose**: Goods receipt header records

```sql
CREATE TABLE goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id),
  status goods_receipt_status DEFAULT 'DRAFT',
  total_value NUMERIC(15,2) DEFAULT 0,
  receipt_date DATE NOT NULL,
  notes TEXT,
  received_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `receipt_number` - Auto-generated (GR-YYYY-####)
- `status` - DRAFT, COMPLETED
- `total_value` - Auto-calculated from items

**Indexes**:
```sql
CREATE INDEX idx_gr_number ON goods_receipts(receipt_number);
CREATE INDEX idx_gr_po ON goods_receipts(purchase_order_id);
```

**Business Rules**:
- Creates inventory_batches on completion
- Updates product quantity_on_hand
- Creates cost_layers

---

### 12. goods_receipt_items

**Purpose**: Goods receipt line items

```sql
CREATE TABLE goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  received_quantity INTEGER NOT NULL,
  batch_number VARCHAR(100),
  expiry_date DATE,
  cost_price NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `received_quantity` - Actual quantity received
- `batch_number` - Batch identifier
- `expiry_date` - Required if product.track_expiry=true
- `cost_price` - Actual cost (may differ from PO)

**Indexes**:
```sql
CREATE INDEX idx_gr_items_gr ON goods_receipt_items(goods_receipt_id);
CREATE INDEX idx_gr_items_product ON goods_receipt_items(product_id);
```

---

### 13. stock_movements

**Purpose**: Complete inventory audit trail

```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number VARCHAR(50) UNIQUE NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  batch_id UUID REFERENCES inventory_batches(id),
  quantity INTEGER NOT NULL,
  movement_type movement_type NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `movement_number` - Auto-generated (SM-YYYY-######)
- `quantity` - Positive = in, Negative = out
- `movement_type` - SALE, PURCHASE, ADJUSTMENT, RETURN, TRANSFER
- `reference_type` - sale, purchase, adjustment, etc.
- `reference_id` - ID of source transaction

**Indexes**:
```sql
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_batch ON stock_movements(batch_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
```

**Business Rules**:
- Auto-created by trigger on sale/GR/adjustment
- Immutable audit trail

---

### 14. cash_registers

**Purpose**: Physical cash register/till records

```sql
CREATE TABLE cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Seed Data**:
- "Main Register" at "Counter 1"

---

### 15. cash_register_sessions

**Purpose**: Cash register opening/closing sessions

```sql
CREATE TABLE cash_register_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id UUID NOT NULL REFERENCES cash_registers(id),
  user_id UUID NOT NULL REFERENCES users(id),
  session_number VARCHAR(50) UNIQUE NOT NULL,
  status session_status DEFAULT 'OPEN',
  opening_float NUMERIC(15,2) NOT NULL,
  expected_closing NUMERIC(15,2) DEFAULT 0,
  actual_closing NUMERIC(15,2),
  variance NUMERIC(15,2) DEFAULT 0,
  denomination_breakdown JSONB,
  payment_summary JSONB,
  opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMPTZ,
  notes TEXT
);
```

**Columns**:
- `session_number` - Auto-generated (CS-YYYY-#####)
- `status` - OPEN, CLOSED
- `opening_float` - Starting cash
- `expected_closing` - Calculated: opening + sales - movements
- `actual_closing` - Physical count
- `variance` - Difference (shortage/overage)
- `denomination_breakdown` - JSON: {"50000": 10, "20000": 20, ...}
- `payment_summary` - JSON: {"cash": 5000, "card": 3000, ...}

**Indexes**:
```sql
CREATE INDEX idx_sessions_register ON cash_register_sessions(register_id);
CREATE INDEX idx_sessions_user ON cash_register_sessions(user_id);
CREATE INDEX idx_sessions_status ON cash_register_sessions(status);
```

**Business Rules**:
- Only one OPEN session per register at a time
- Sales must reference active session

---

### 16. cash_movements

**Purpose**: Non-sale cash movements (float, payouts, deposits)

```sql
CREATE TABLE cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cash_register_sessions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  movement_type cash_movement_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  reference_type VARCHAR(50),
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `movement_type` - FLOAT_IN, FLOAT_OUT, PAYOUT, BANK_DEPOSIT
- `amount` - Always positive
- `description` - Required explanation

**Indexes**:
```sql
CREATE INDEX idx_cash_movements_session ON cash_movements(session_id);
CREATE INDEX idx_cash_movements_type ON cash_movements(movement_type);
```

---

### 17. sales

**Purpose**: Sale transaction header records

```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  subtotal NUMERIC(15,2) NOT NULL,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  total_cost NUMERIC(15,2) DEFAULT 0,
  profit NUMERIC(15,2) DEFAULT 0,
  profit_margin NUMERIC(5,2) DEFAULT 0,
  payment_method payment_method NOT NULL,
  amount_paid NUMERIC(15,2),
  change_amount NUMERIC(15,2),
  cash_register_session_id UUID REFERENCES cash_register_sessions(id),
  sale_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `sale_number` - Auto-generated (SALE-YYYY-#####)
- `subtotal` - Before tax
- `discount_amount` - Total discounts
- `tax_amount` - **CRITICAL**: Provided by frontend, NOT recalculated
- `total_amount` - (subtotal - discount) + tax
- `total_cost` - Sum of item costs
- `profit` - (subtotal - discount) - total_cost (EXCLUDES TAX)
- `profit_margin` - (profit / (subtotal - discount)) * 100
- `payment_method` - CASH, CARD, MOBILE_MONEY, CREDIT

**Indexes**:
```sql
CREATE INDEX idx_sales_number ON sales(sale_number);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_session ON sales(cash_register_session_id);
CREATE INDEX idx_sales_payment_method ON sales(payment_method);
```

**Business Rules (CRITICAL)**:
- **tax_amount preserved from frontend** - trigger does NOT recalculate
- Profit EXCLUDES tax: (subtotal - discount - cost)
- CREDIT sales create invoice entry

---

### 18. sale_items

**Purpose**: Sale transaction line items

```sql
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  batch_id UUID REFERENCES inventory_batches(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(15,2) NOT NULL,
  unit_cost NUMERIC(15,2) NOT NULL,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  total_price NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `batch_id` - Optional (auto-selected FEFO if null)
- `unit_price` - Selling price (can be discounted)
- `unit_cost` - Cost from batch/cost layer
- `total_price` - quantity * (unit_price - discount)

**Indexes**:
```sql
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_sale_items_batch ON sale_items(batch_id);
```

**Business Rules**:
- Inserts trigger stock movements
- Updates batch remaining_quantity
- Updates cost layers

---

### 19. invoices

**Purpose**: Credit sale invoices (accounts receivable)

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  sale_id UUID REFERENCES sales(id),
  status invoice_status DEFAULT 'UNPAID',
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  amount_paid NUMERIC(15,2) DEFAULT 0,
  amount_due NUMERIC(15,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `invoice_number` - Auto-generated (INV-#####)
- `status` - UNPAID, PARTIALLY_PAID, PAID, OVERDUE
- `amount_due` - total_amount - amount_paid

**Indexes**:
```sql
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
```

**Business Rules**:
- Auto-created for CREDIT sales
- Status auto-updated on payment

---

### 20. invoice_payments

**Purpose**: Payments against invoices

```sql
CREATE TABLE invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  amount NUMERIC(15,2) NOT NULL,
  payment_method payment_method NOT NULL,
  payment_date DATE NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `amount` - Payment amount
- `reference_number` - Check number, transaction ID, etc.

**Indexes**:
```sql
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);
```

**Business Rules**:
- Inserts trigger invoice balance update
- Updates customer balance

---

## 🔧 Custom Types (ENUMs)

```sql
CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF');

CREATE TYPE sale_status AS ENUM ('COMPLETED', 'PENDING', 'CANCELLED');

CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'MOBILE_MONEY', 'CREDIT');

CREATE TYPE purchase_order_status AS ENUM ('DRAFT', 'PENDING', 'COMPLETED', 'CANCELLED');

CREATE TYPE goods_receipt_status AS ENUM ('DRAFT', 'COMPLETED');

CREATE TYPE batch_status AS ENUM ('ACTIVE', 'DEPLETED', 'EXPIRED', 'DAMAGED');

CREATE TYPE movement_type AS ENUM ('SALE', 'PURCHASE', 'ADJUSTMENT', 'RETURN', 'TRANSFER');

CREATE TYPE costing_method AS ENUM ('FIFO', 'AVCO');

CREATE TYPE invoice_status AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');

CREATE TYPE session_status AS ENUM ('OPEN', 'CLOSED');

CREATE TYPE cash_movement_type AS ENUM ('FLOAT_IN', 'FLOAT_OUT', 'PAYOUT', 'BANK_DEPOSIT');
```

---

## ⚙️ Triggers & Functions

### 1. fn_update_sale_totals_internal()

**Purpose**: Calculate sale totals, cost, profit

**CRITICAL FIX**: Preserves `tax_amount` from sales table, does NOT recalculate

```sql
CREATE OR REPLACE FUNCTION fn_update_sale_totals_internal()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal NUMERIC(15,2);
  v_total_cost NUMERIC(15,2);
  v_discount NUMERIC(15,2);
  v_tax_amount NUMERIC(15,2);
  v_total NUMERIC(15,2);
  v_profit NUMERIC(15,2);
  v_margin NUMERIC(5,2);
BEGIN
  -- Get values from sales table
  SELECT 
    COALESCE(discount_amount, 0),
    tax_amount  -- CRITICAL: Use tax from sales, don't recalculate
  INTO v_discount, v_tax_amount
  FROM sales WHERE id = NEW.sale_id;

  -- Calculate subtotal from items
  SELECT 
    COALESCE(SUM((quantity * unit_price) - discount_amount), 0),
    COALESCE(SUM(quantity * unit_cost), 0)
  INTO v_subtotal, v_total_cost
  FROM sale_items WHERE sale_id = NEW.sale_id;

  -- Calculate total: (subtotal - discount) + tax
  v_total := (v_subtotal - v_discount) + v_tax_amount;

  -- Calculate profit: EXCLUDES TAX
  v_profit := (v_subtotal - v_discount) - v_total_cost;

  -- Calculate margin
  IF (v_subtotal - v_discount) > 0 THEN
    v_margin := (v_profit / (v_subtotal - v_discount)) * 100;
  ELSE
    v_margin := 0;
  END IF;

  -- Update sales table
  UPDATE sales SET
    subtotal = v_subtotal,
    total_cost = v_total_cost,
    total_amount = v_total,
    profit = v_profit,
    profit_margin = v_margin,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.sale_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_sale_totals
AFTER INSERT OR UPDATE OR DELETE ON sale_items
FOR EACH ROW EXECUTE FUNCTION fn_update_sale_totals_internal();
```

**Why This Fix**:
- Previous bug: Trigger recalculated tax from items, causing mismatch
- Solution: Tax calculated once in frontend, preserved in trigger
- Prevents "Sale total validation failed" error

---

### 2. fn_update_customer_balance_internal()

**Purpose**: Auto-update customer balance on credit sales/payments

```sql
CREATE OR REPLACE FUNCTION fn_update_customer_balance_internal()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate customer balance
  UPDATE customers c SET
    balance = COALESCE((
      SELECT SUM(amount_due)
      FROM invoices
      WHERE customer_id = c.id AND status != 'PAID'
    ), 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = COALESCE(NEW.customer_id, OLD.customer_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_customer_balance_invoice
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION fn_update_customer_balance_internal();

CREATE TRIGGER trg_update_customer_balance_payment
AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
FOR EACH ROW EXECUTE FUNCTION fn_update_customer_balance_internal();
```

---

### 3. fn_update_supplier_balance_internal()

**Purpose**: Auto-update supplier balance on GRs/payments

```sql
CREATE OR REPLACE FUNCTION fn_update_supplier_balance_internal()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate supplier balance
  UPDATE suppliers s SET
    balance = COALESCE((
      SELECT SUM(total_value)
      FROM goods_receipts gr
      JOIN purchase_orders po ON gr.purchase_order_id = po.id
      WHERE po.supplier_id = s.id AND gr.status = 'COMPLETED'
    ), 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.supplier_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_supplier_balance
AFTER INSERT OR UPDATE ON goods_receipts
FOR EACH ROW EXECUTE FUNCTION fn_update_supplier_balance_internal();
```

---

### 4. fn_update_inventory_quantity_internal()

**Purpose**: Auto-update product.quantity_on_hand from batches

```sql
CREATE OR REPLACE FUNCTION fn_update_inventory_quantity_internal()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products SET
    quantity_on_hand = COALESCE((
      SELECT SUM(remaining_quantity)
      FROM inventory_batches
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        AND status = 'ACTIVE'
    ), 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_inventory_quantity
AFTER INSERT OR UPDATE OR DELETE ON inventory_batches
FOR EACH ROW EXECUTE FUNCTION fn_update_inventory_quantity_internal();
```

---

### 5. fn_update_po_totals_internal()

**Purpose**: Calculate PO total from line items

```sql
CREATE OR REPLACE FUNCTION fn_update_po_totals_internal()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_orders SET
    total_amount = COALESCE((
      SELECT SUM(ordered_quantity * unit_price)
      FROM purchase_order_items
      WHERE purchase_order_id = NEW.purchase_order_id
    ), 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.purchase_order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_po_totals
AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION fn_update_po_totals_internal();
```

---

### 6. fn_update_gr_totals_internal()

**Purpose**: Calculate GR total from items

```sql
CREATE OR REPLACE FUNCTION fn_update_gr_totals_internal()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE goods_receipts SET
    total_value = COALESCE((
      SELECT SUM(received_quantity * cost_price)
      FROM goods_receipt_items
      WHERE goods_receipt_id = NEW.goods_receipt_id
    ), 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.goods_receipt_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_gr_totals
AFTER INSERT OR UPDATE OR DELETE ON goods_receipt_items
FOR EACH ROW EXECUTE FUNCTION fn_update_gr_totals_internal();
```

---

### 7. fn_update_invoice_balance_internal()

**Purpose**: Update invoice balance and status on payments

```sql
CREATE OR REPLACE FUNCTION fn_update_invoice_balance_internal()
RETURNS TRIGGER AS $$
DECLARE
  v_total NUMERIC(15,2);
  v_paid NUMERIC(15,2);
  v_due NUMERIC(15,2);
  v_status invoice_status;
BEGIN
  -- Get totals
  SELECT 
    total_amount,
    COALESCE((SELECT SUM(amount) FROM invoice_payments WHERE invoice_id = NEW.invoice_id), 0)
  INTO v_total, v_paid
  FROM invoices WHERE id = NEW.invoice_id;

  v_due := v_total - v_paid;

  -- Determine status
  IF v_due <= 0 THEN
    v_status := 'PAID';
  ELSIF v_paid > 0 THEN
    v_status := 'PARTIALLY_PAID';
  ELSE
    v_status := 'UNPAID';
  END IF;

  -- Update invoice
  UPDATE invoices SET
    amount_paid = v_paid,
    amount_due = v_due,
    status = v_status,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_invoice_balance
AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
FOR EACH ROW EXECUTE FUNCTION fn_update_invoice_balance_internal();
```

---

### 8. fn_log_stock_movement()

**Purpose**: Auto-create stock_movements on inventory changes

```sql
CREATE OR REPLACE FUNCTION fn_log_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Log movement
  INSERT INTO stock_movements (
    movement_number,
    product_id,
    batch_id,
    quantity,
    movement_type,
    reference_type,
    reference_id
  ) VALUES (
    'SM-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('movement_seq')::TEXT, 6, '0'),
    NEW.product_id,
    NEW.batch_id,
    NEW.quantity,
    -- Determine type from context
    CASE 
      WHEN TG_TABLE_NAME = 'sale_items' THEN 'SALE'
      WHEN TG_TABLE_NAME = 'goods_receipt_items' THEN 'PURCHASE'
      ELSE 'ADJUSTMENT'
    END,
    TG_TABLE_NAME,
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_stock_movement_sale
AFTER INSERT ON sale_items
FOR EACH ROW EXECUTE FUNCTION fn_log_stock_movement();

CREATE TRIGGER trg_log_stock_movement_gr
AFTER INSERT ON goods_receipt_items
FOR EACH ROW EXECUTE FUNCTION fn_log_stock_movement();
```

---

## 📝 Query Examples

### Get Current Inventory Value

```sql
SELECT 
  SUM(ib.remaining_quantity * ib.cost_price) as total_inventory_value
FROM inventory_batches ib
WHERE ib.status = 'ACTIVE';
```

### Get Customer Balance Aging

```sql
SELECT 
  c.name,
  c.balance,
  SUM(CASE WHEN CURRENT_DATE - i.due_date <= 30 THEN i.amount_due ELSE 0 END) as current_30,
  SUM(CASE WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND 60 THEN i.amount_due ELSE 0 END) as days_31_60,
  SUM(CASE WHEN CURRENT_DATE - i.due_date BETWEEN 61 AND 90 THEN i.amount_due ELSE 0 END) as days_61_90,
  SUM(CASE WHEN CURRENT_DATE - i.due_date > 90 THEN i.amount_due ELSE 0 END) as over_90
FROM customers c
LEFT JOIN invoices i ON c.id = i.customer_id AND i.status != 'PAID'
WHERE c.balance < 0
GROUP BY c.id, c.name, c.balance;
```

### Get Sales by Period

```sql
SELECT 
  DATE_TRUNC('day', sale_date) as date,
  COUNT(*) as transaction_count,
  SUM(subtotal) as gross_sales,
  SUM(discount_amount) as discounts,
  SUM(tax_amount) as taxes,
  SUM(total_amount) as net_sales,
  SUM(total_cost) as cost_of_goods,
  SUM(profit) as gross_profit,
  AVG(profit_margin) as avg_margin
FROM sales
WHERE sale_date BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY DATE_TRUNC('day', sale_date)
ORDER BY date;
```

### Get Expiring Stock

```sql
SELECT 
  p.name,
  ib.batch_number,
  ib.remaining_quantity,
  ib.expiry_date,
  (ib.expiry_date - CURRENT_DATE) as days_until_expiry
FROM inventory_batches ib
JOIN products p ON ib.product_id = p.id
WHERE ib.status = 'ACTIVE'
  AND ib.expiry_date IS NOT NULL
  AND ib.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY ib.expiry_date;
```

### Get FEFO Batch Selection

```sql
SELECT 
  id,
  batch_number,
  remaining_quantity,
  expiry_date,
  cost_price
FROM inventory_batches
WHERE product_id = :product_id
  AND status = 'ACTIVE'
  AND remaining_quantity > 0
ORDER BY 
  CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,  -- Non-expiry batches last
  expiry_date NULLS LAST,  -- Earliest expiry first
  received_date  -- Then oldest received
LIMIT 1;
```

---

## 🔒 Data Integrity Rules

1. **Referential Integrity**: All foreign keys enforced with ON DELETE CASCADE where appropriate
2. **Check Constraints**: Positive quantities, valid percentages
3. **Unique Constraints**: SKUs, barcodes, email addresses, generated numbers
4. **NOT NULL Constraints**: Critical fields must have values
5. **Trigger Validation**: Business rules enforced in triggers
6. **JSONB Validation**: denomination_breakdown, payment_summary structure validated

---

## 🔄 Migration Notes

**Schema Version**: 1.0.0

**Apply Scripts in Order**:
1. `01_schema.sql` - Tables, indexes, seed data
2. `02_triggers.sql` - Functions and triggers (INCLUDES TAX FIX)
3. `03_seed.sql` - Optional test data

**Rollback**: Drop database and recreate

**Future Migrations**: Use numbered migration files (04_, 05_, etc.)

---

## 📊 Performance Considerations

**Indexes Created For**:
- Foreign key lookups
- Search operations (name, SKU, barcode)
- Date range queries
- Status filtering
- FEFO batch selection

**Query Optimization**:
- Use CTEs for complex queries
- Leverage indexes in WHERE clauses
- EXPLAIN ANALYZE for slow queries

**Maintenance**:
```sql
-- Analyze tables monthly
ANALYZE;

-- Vacuum to reclaim space
VACUUM ANALYZE;

-- Reindex if needed
REINDEX DATABASE digitalshop;
```

---

**Last Updated**: January 29, 2026
**Version**: 1.0.0
