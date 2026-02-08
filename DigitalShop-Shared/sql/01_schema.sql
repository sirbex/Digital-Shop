-- ============================================================================
-- DIGITALSHOP DATABASE SCHEMA
-- ============================================================================
-- Complete Point of Sale, Inventory, and Reports System
-- PostgreSQL 14+
-- Created: January 29, 2026
-- Database: digitalshop
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search performance

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

-- User roles
CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF');

-- Sale status
CREATE TYPE sale_status AS ENUM ('COMPLETED', 'VOID', 'REFUNDED');

-- Payment methods
CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CREDIT');

-- Purchase order status
CREATE TYPE purchase_order_status AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- Goods receipt status
CREATE TYPE goods_receipt_status AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- Batch status
CREATE TYPE batch_status AS ENUM ('ACTIVE', 'DEPLETED', 'EXPIRED', 'QUARANTINED');

-- Stock movement types
CREATE TYPE movement_type AS ENUM ('GOODS_RECEIPT', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'DAMAGE', 'EXPIRY');

-- Costing methods
CREATE TYPE costing_method AS ENUM ('FIFO', 'AVCO', 'STANDARD');

-- Invoice status
CREATE TYPE invoice_status AS ENUM ('DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED');

-- Session status for cash registers
CREATE TYPE session_status AS ENUM ('OPEN', 'CLOSED', 'RECONCILED');

-- Cash movement types
CREATE TYPE cash_movement_type AS ENUM ('CASH_IN', 'CASH_IN_FLOAT', 'CASH_IN_PAYMENT', 'CASH_IN_OTHER', 'CASH_OUT', 'CASH_OUT_BANK', 'CASH_OUT_EXPENSE', 'CASH_OUT_OTHER', 'SALE', 'REFUND', 'FLOAT_ADJUSTMENT');

-- ============================================================================
-- 1. USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'CASHIER',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

COMMENT ON TABLE users IS 'System users with authentication and role-based access';
COMMENT ON COLUMN users.role IS 'User role: ADMIN, MANAGER, CASHIER, or STAFF';

-- ============================================================================
-- 2. CUSTOMER GROUPS
-- ============================================================================

CREATE TABLE customer_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    discount_percentage DECIMAL(5, 4) DEFAULT 0.0000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_discount_percentage CHECK (discount_percentage >= 0 AND discount_percentage <= 1)
);

CREATE INDEX idx_customer_groups_active ON customer_groups(is_active) WHERE is_active = true;

COMMENT ON TABLE customer_groups IS 'Customer segmentation for tiered pricing (e.g., Retail, Wholesale, VIP)';
COMMENT ON COLUMN customer_groups.discount_percentage IS 'Default discount as decimal (0.1 = 10%)';

-- ============================================================================
-- 3. CUSTOMERS
-- ============================================================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    customer_group_id UUID REFERENCES customer_groups(id) ON DELETE SET NULL,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    credit_limit DECIMAL(15, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_credit_limit CHECK (credit_limit >= 0)
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_group ON customers(customer_group_id);
CREATE INDEX idx_customers_active ON customers(is_active) WHERE is_active = true;
CREATE INDEX idx_customers_name_trgm ON customers USING gin(name gin_trgm_ops);

COMMENT ON TABLE customers IS 'Customer master data with credit tracking';
COMMENT ON COLUMN customers.balance IS 'Account balance: negative = customer owes us (receivable), positive = we owe customer (prepaid/credit)';
COMMENT ON COLUMN customers.credit_limit IS 'Maximum allowed credit balance';

-- ============================================================================
-- 4. SUPPLIERS
-- ============================================================================

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    payment_terms VARCHAR(50) DEFAULT 'NET30',
    balance DECIMAL(15, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_active ON suppliers(is_active) WHERE is_active = true;

COMMENT ON TABLE suppliers IS 'Supplier master data for purchase orders';
COMMENT ON COLUMN suppliers.balance IS 'Amount we owe supplier (positive = we owe them)';

-- ============================================================================
-- 5. PRODUCTS
-- ============================================================================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit_of_measure VARCHAR(50) DEFAULT 'PCS',
    conversion_factor DECIMAL(15, 4) DEFAULT 1.0000,
    cost_price DECIMAL(15, 2) DEFAULT 0.00,
    selling_price DECIMAL(15, 2) DEFAULT 0.00,
    costing_method costing_method DEFAULT 'FIFO',
    average_cost DECIMAL(15, 2) DEFAULT 0.00,
    last_cost DECIMAL(15, 2) DEFAULT 0.00,
    pricing_formula TEXT,
    auto_update_price BOOLEAN DEFAULT false,
    quantity_on_hand DECIMAL(15, 4) DEFAULT 0.0000,
    reorder_level DECIMAL(15, 4) DEFAULT 0.0000,
    track_expiry BOOLEAN DEFAULT false,
    is_taxable BOOLEAN DEFAULT true,
    tax_rate DECIMAL(5, 4) DEFAULT 0.0600,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_selling_price CHECK (selling_price >= 0),
    CONSTRAINT chk_cost_price CHECK (cost_price >= 0),
    CONSTRAINT chk_tax_rate CHECK (tax_rate >= 0 AND tax_rate <= 1)
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

COMMENT ON TABLE products IS 'Product catalog with pricing and inventory settings';
COMMENT ON COLUMN products.costing_method IS 'Inventory valuation method: FIFO, AVCO, or STANDARD';
COMMENT ON COLUMN products.track_expiry IS 'Whether to track expiry dates for this product';
COMMENT ON COLUMN products.tax_rate IS 'Tax rate as decimal (0.06 = 6%)';

-- ============================================================================
-- 6. INVENTORY BATCHES (FEFO Tracking)
-- ============================================================================

CREATE TABLE inventory_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(100) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT inventory_batches_product_batch_unique UNIQUE (product_id, batch_number),
    quantity DECIMAL(15, 4) NOT NULL,
    remaining_quantity DECIMAL(15, 4) NOT NULL,
    cost_price DECIMAL(15, 2) NOT NULL,
    expiry_date DATE,
    received_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status batch_status DEFAULT 'ACTIVE',
    source_type VARCHAR(50),
    source_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_batch_quantity CHECK (quantity > 0),
    CONSTRAINT chk_batch_remaining CHECK (remaining_quantity >= 0 AND remaining_quantity <= quantity),
    CONSTRAINT chk_batch_cost CHECK (cost_price >= 0)
);

CREATE INDEX idx_batches_product ON inventory_batches(product_id);
CREATE INDEX idx_batches_expiry ON inventory_batches(expiry_date);
CREATE INDEX idx_batches_status ON inventory_batches(status);
CREATE INDEX idx_batches_fefo ON inventory_batches(product_id, expiry_date, remaining_quantity) WHERE status = 'ACTIVE';
CREATE INDEX idx_batches_source ON inventory_batches(source_type, source_id);

COMMENT ON TABLE inventory_batches IS 'Batch-level inventory tracking with FEFO (First Expiry First Out)';
COMMENT ON COLUMN inventory_batches.status IS 'ACTIVE, DEPLETED, EXPIRED, or QUARANTINED';
COMMENT ON INDEX idx_batches_fefo IS 'Optimized for FEFO allocation queries';

-- ============================================================================
-- 7. COST LAYERS (FIFO/AVCO Valuation)
-- ============================================================================

CREATE TABLE cost_layers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(15, 4) NOT NULL,
    remaining_quantity DECIMAL(15, 4) NOT NULL,
    unit_cost DECIMAL(15, 2) NOT NULL,
    received_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    batch_number VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_layer_quantity CHECK (quantity > 0),
    CONSTRAINT chk_layer_remaining CHECK (remaining_quantity >= 0 AND remaining_quantity <= quantity),
    CONSTRAINT chk_layer_cost CHECK (unit_cost >= 0)
);

CREATE INDEX idx_cost_layers_product ON cost_layers(product_id);
CREATE INDEX idx_cost_layers_received ON cost_layers(received_date);
CREATE INDEX idx_cost_layers_active ON cost_layers(is_active) WHERE is_active = true;
CREATE INDEX idx_cost_layers_fifo ON cost_layers(product_id, received_date, remaining_quantity) WHERE is_active = true;

COMMENT ON TABLE cost_layers IS 'Cost layer tracking for FIFO/AVCO inventory valuation';
COMMENT ON INDEX idx_cost_layers_fifo IS 'Optimized for FIFO cost allocation';

-- ============================================================================
-- 8. PRICING TIERS
-- ============================================================================

CREATE TABLE pricing_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_group_id UUID REFERENCES customer_groups(id) ON DELETE CASCADE,
    name VARCHAR(255),
    pricing_formula TEXT NOT NULL,
    calculated_price DECIMAL(15, 2) NOT NULL,
    min_quantity DECIMAL(15, 4) DEFAULT 1.0000,
    max_quantity DECIMAL(15, 4),
    priority INTEGER DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_tier_price CHECK (calculated_price >= 0),
    CONSTRAINT chk_tier_quantity CHECK (min_quantity > 0 AND (max_quantity IS NULL OR max_quantity >= min_quantity))
);

CREATE INDEX idx_pricing_product ON pricing_tiers(product_id);
CREATE INDEX idx_pricing_group ON pricing_tiers(customer_group_id);
CREATE INDEX idx_pricing_active ON pricing_tiers(is_active) WHERE is_active = true;

COMMENT ON TABLE pricing_tiers IS 'Tiered pricing based on customer group and quantity breaks';

-- ============================================================================
-- 9. PURCHASE ORDERS
-- ============================================================================

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expected_delivery_date TIMESTAMP WITH TIME ZONE,
    status purchase_order_status DEFAULT 'DRAFT',
    payment_terms VARCHAR(50),
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    notes TEXT,
    created_by_id UUID REFERENCES users(id),
    sent_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_po_total CHECK (total_amount >= 0)
);

CREATE INDEX idx_po_number ON purchase_orders(order_number);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_order_date ON purchase_orders(order_date);

COMMENT ON TABLE purchase_orders IS 'Purchase orders to suppliers for inventory replenishment';

-- ============================================================================
-- 10. PURCHASE ORDER ITEMS
-- ============================================================================

CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    ordered_quantity DECIMAL(15, 4) NOT NULL,
    received_quantity DECIMAL(15, 4) DEFAULT 0.0000,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_poi_ordered_qty CHECK (ordered_quantity > 0),
    CONSTRAINT chk_poi_received_qty CHECK (received_quantity >= 0 AND received_quantity <= ordered_quantity),
    CONSTRAINT chk_poi_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_poi_total_price CHECK (total_price >= 0)
);

CREATE INDEX idx_po_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_po_items_product ON purchase_order_items(product_id);

COMMENT ON TABLE purchase_order_items IS 'Line items for purchase orders';

-- ============================================================================
-- 11. GOODS RECEIPTS
-- ============================================================================

CREATE TABLE goods_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id),
    received_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    received_by_id UUID REFERENCES users(id),
    status goods_receipt_status DEFAULT 'DRAFT',
    total_value DECIMAL(15, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_gr_total CHECK (total_value >= 0)
);

CREATE INDEX idx_gr_number ON goods_receipts(receipt_number);
CREATE INDEX idx_gr_po ON goods_receipts(purchase_order_id);
CREATE INDEX idx_gr_status ON goods_receipts(status);
CREATE INDEX idx_gr_received_date ON goods_receipts(received_date);

COMMENT ON TABLE goods_receipts IS 'Record of goods received from suppliers';

-- ============================================================================
-- 12. GOODS RECEIPT ITEMS
-- ============================================================================

CREATE TABLE goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    purchase_order_item_id UUID REFERENCES purchase_order_items(id),
    received_quantity DECIMAL(15, 4) NOT NULL,
    batch_number VARCHAR(100),
    expiry_date DATE,
    cost_price DECIMAL(15, 2) NOT NULL,
    discrepancy_type VARCHAR(50) DEFAULT 'NONE',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_gri_received_qty CHECK (received_quantity > 0),
    CONSTRAINT chk_gri_cost CHECK (cost_price >= 0)
);

CREATE INDEX idx_gr_items_receipt ON goods_receipt_items(goods_receipt_id);
CREATE INDEX idx_gr_items_product ON goods_receipt_items(product_id);
CREATE INDEX idx_gr_items_po_item ON goods_receipt_items(purchase_order_item_id);

COMMENT ON TABLE goods_receipt_items IS 'Line items for goods receipts with batch tracking';

-- ============================================================================
-- 13. STOCK MOVEMENTS
-- ============================================================================

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_number VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id),
    batch_id UUID REFERENCES inventory_batches(id),
    movement_type movement_type NOT NULL,
    quantity DECIMAL(15, 4) NOT NULL,
    unit_cost DECIMAL(15, 2),
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    created_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_movement_quantity CHECK (quantity != 0)
);

CREATE INDEX idx_movements_product ON stock_movements(product_id);
CREATE INDEX idx_movements_batch ON stock_movements(batch_id);
CREATE INDEX idx_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_movements_created_at ON stock_movements(created_at);

COMMENT ON TABLE stock_movements IS 'Audit trail of all inventory movements';
COMMENT ON COLUMN stock_movements.movement_type IS 'Type: GOODS_RECEIPT, SALE, ADJUSTMENT_IN, ADJUSTMENT_OUT, etc.';

-- ============================================================================
-- 14. CASH REGISTERS
-- ============================================================================

CREATE TABLE cash_registers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    location VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_registers_active ON cash_registers(is_active) WHERE is_active = true;

COMMENT ON TABLE cash_registers IS 'Physical cash register/POS terminal configuration';

-- ============================================================================
-- 15. CASH REGISTER SESSIONS
-- ============================================================================

CREATE TABLE cash_register_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    register_id UUID NOT NULL REFERENCES cash_registers(id),
    user_id UUID NOT NULL REFERENCES users(id),
    session_number VARCHAR(50) UNIQUE NOT NULL,
    status session_status DEFAULT 'OPEN',
    opening_float DECIMAL(15, 2) NOT NULL DEFAULT 0,
    expected_closing DECIMAL(15, 2),
    actual_closing DECIMAL(15, 2),
    variance DECIMAL(15, 2),
    variance_reason TEXT,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    reconciled_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    blind_count_enabled BOOLEAN DEFAULT false,
    denomination_breakdown JSONB,
    payment_summary JSONB,
    variance_approved_by UUID REFERENCES users(id),
    variance_approved_at TIMESTAMP WITH TIME ZONE,
    variance_threshold DECIMAL(15, 2) DEFAULT 0,
    
    CONSTRAINT chk_session_opening_float CHECK (opening_float >= 0),
    CONSTRAINT chk_session_variance_threshold CHECK (variance_threshold >= 0)
);

CREATE INDEX idx_sessions_register ON cash_register_sessions(register_id);
CREATE INDEX idx_sessions_user ON cash_register_sessions(user_id);
CREATE INDEX idx_sessions_status ON cash_register_sessions(status);
CREATE INDEX idx_sessions_opened_at ON cash_register_sessions(opened_at);
CREATE INDEX idx_sessions_number ON cash_register_sessions(session_number);

COMMENT ON TABLE cash_register_sessions IS 'Cash register shift sessions with opening/closing reconciliation';
COMMENT ON COLUMN cash_register_sessions.blind_count_enabled IS 'When true, cashier cannot see expected closing before entering actual count';
COMMENT ON COLUMN cash_register_sessions.denomination_breakdown IS 'JSON object tracking cash by denomination: {100: 5, 50: 10, ...}';
COMMENT ON COLUMN cash_register_sessions.payment_summary IS 'Summary by payment method: {CASH: 5000, CARD: 2000, MOBILE_MONEY: 1000}';

-- ============================================================================
-- 16. CASH MOVEMENTS
-- ============================================================================

CREATE TABLE cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES cash_register_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    movement_type cash_movement_type NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    reason VARCHAR(255),
    reference_type VARCHAR(50),
    reference_id UUID,
    approved_by UUID REFERENCES users(id),
    payment_method VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_cash_movement_amount CHECK (amount != 0)
);

CREATE INDEX idx_cash_movements_session ON cash_movements(session_id);
CREATE INDEX idx_cash_movements_user ON cash_movements(user_id);
CREATE INDEX idx_cash_movements_type ON cash_movements(movement_type);
CREATE INDEX idx_cash_movements_reference ON cash_movements(reference_type, reference_id);
CREATE INDEX idx_cash_movements_created_at ON cash_movements(created_at);

COMMENT ON TABLE cash_movements IS 'Record of all cash in/out transactions in register sessions';
COMMENT ON COLUMN cash_movements.movement_type IS 'Type: CASH_IN, CASH_OUT, SALE, REFUND, etc.';

-- ============================================================================
-- 17. SALES
-- ============================================================================

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    sale_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(15, 2) NOT NULL,
    tax_amount DECIMAL(15, 2) DEFAULT 0.00,
    discount_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_amount DECIMAL(15, 2) NOT NULL,
    total_cost DECIMAL(15, 2) DEFAULT 0.00,
    profit DECIMAL(15, 2) DEFAULT 0.00,
    profit_margin DECIMAL(5, 4) DEFAULT 0.0000,
    payment_method payment_method NOT NULL,
    amount_paid DECIMAL(15, 2) NOT NULL,
    change_amount DECIMAL(15, 2) DEFAULT 0.00,
    status sale_status DEFAULT 'COMPLETED',
    notes TEXT,
    cashier_id UUID REFERENCES users(id),
    cash_register_session_id UUID REFERENCES cash_register_sessions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_sale_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_sale_tax CHECK (tax_amount >= 0),
    CONSTRAINT chk_sale_discount CHECK (discount_amount >= 0),
    CONSTRAINT chk_sale_total CHECK (total_amount >= 0),
    CONSTRAINT chk_sale_amount_paid CHECK (amount_paid >= 0),
    CONSTRAINT chk_sale_change CHECK (change_amount >= 0),
    CONSTRAINT chk_sale_profit_margin CHECK (profit_margin >= -1 AND profit_margin <= 10)
);

CREATE INDEX idx_sales_number ON sales(sale_number);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_session ON sales(cash_register_session_id);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_payment_method ON sales(payment_method);

COMMENT ON TABLE sales IS 'Completed sales transactions';
COMMENT ON COLUMN sales.profit_margin IS 'Profit margin as decimal ratio (0.25 = 25%)';

-- ============================================================================
-- 18. SALE ITEMS
-- ============================================================================

CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    batch_id UUID REFERENCES inventory_batches(id),
    quantity DECIMAL(15, 4) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    unit_cost DECIMAL(15, 2) DEFAULT 0.00,
    discount_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_price DECIMAL(15, 2) NOT NULL,
    profit DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_sale_item_quantity CHECK (quantity > 0),
    CONSTRAINT chk_sale_item_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_sale_item_unit_cost CHECK (unit_cost >= 0),
    CONSTRAINT chk_sale_item_discount CHECK (discount_amount >= 0),
    CONSTRAINT chk_sale_item_total CHECK (total_price >= 0)
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_sale_items_batch ON sale_items(batch_id);

COMMENT ON TABLE sale_items IS 'Line items for sales transactions';

-- ============================================================================
-- 19. INVOICES
-- ============================================================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    sale_id UUID REFERENCES sales(id),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(15, 2) DEFAULT 0.00,
    amount_due DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status invoice_status DEFAULT 'DRAFT',
    notes TEXT,
    created_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_invoice_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_invoice_tax CHECK (tax_amount >= 0),
    CONSTRAINT chk_invoice_discount CHECK (discount_amount >= 0),
    CONSTRAINT chk_invoice_total CHECK (total_amount >= 0),
    CONSTRAINT chk_invoice_amount_paid CHECK (amount_paid >= 0),
    CONSTRAINT chk_invoice_amount_due CHECK (amount_due >= 0)
);

CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_sale ON invoices(sale_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);

COMMENT ON TABLE invoices IS 'Customer invoices for credit sales';

-- ============================================================================
-- 20. INVOICE PAYMENTS
-- ============================================================================

CREATE TABLE invoice_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payment_method payment_method NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    reference_number VARCHAR(200),
    notes TEXT,
    processed_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_invoice_payment_amount CHECK (amount > 0)
);

CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_date ON invoice_payments(payment_date);
CREATE INDEX idx_invoice_payments_receipt_number ON invoice_payments(receipt_number);

COMMENT ON TABLE invoice_payments IS 'Payments received against customer invoices';

-- ============================================================================
-- 21. POS HELD ORDERS (Put on Hold/Resume)
-- ============================================================================

-- Hold status type
CREATE TYPE hold_status AS ENUM ('ACTIVE', 'RESUMED', 'EXPIRED', 'CANCELLED');

-- Table: pos_held_orders
-- Stores cart state temporarily without creating invoices or stock movements
CREATE TABLE pos_held_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hold_number VARCHAR(50) UNIQUE NOT NULL,
    terminal_id VARCHAR(100),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    
    -- Financial summary (for display only - not finalized)
    subtotal DECIMAL(15, 4) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15, 4) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15, 4) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15, 4) NOT NULL DEFAULT 0,
    
    -- Hold metadata
    hold_reason VARCHAR(255),
    notes TEXT,
    metadata JSONB,
    status hold_status DEFAULT 'ACTIVE',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    resumed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT chk_pos_held_orders_amounts CHECK (
        subtotal >= 0 AND
        tax_amount >= 0 AND
        discount_amount >= 0 AND
        total_amount >= 0
    )
);

-- Table: pos_held_order_items
-- Line items for held orders
CREATE TABLE pos_held_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hold_id UUID NOT NULL REFERENCES pos_held_orders(id) ON DELETE CASCADE,
    
    -- Product information
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    
    -- Quantity and pricing
    quantity DECIMAL(15, 4) NOT NULL,
    unit_price DECIMAL(15, 4) NOT NULL,
    cost_price DECIMAL(15, 4) NOT NULL DEFAULT 0,
    subtotal DECIMAL(15, 4) NOT NULL,
    
    -- Tax
    is_taxable BOOLEAN NOT NULL DEFAULT true,
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15, 4) NOT NULL DEFAULT 0,
    
    -- Discount (item-level)
    discount_type VARCHAR(20),
    discount_value DECIMAL(15, 4),
    discount_amount DECIMAL(15, 4) NOT NULL DEFAULT 0,
    discount_reason TEXT,
    
    -- Metadata
    metadata JSONB,
    
    -- Sort order
    line_order INTEGER NOT NULL DEFAULT 0,
    
    -- Constraints
    CONSTRAINT chk_pos_held_order_items_amounts CHECK (
        quantity > 0 AND
        unit_price >= 0 AND
        cost_price >= 0 AND
        subtotal >= 0 AND
        tax_rate >= 0 AND
        tax_amount >= 0 AND
        discount_amount >= 0
    )
);

-- Indexes for performance
CREATE INDEX idx_pos_held_orders_user_id ON pos_held_orders(user_id);
CREATE INDEX idx_pos_held_orders_terminal_id ON pos_held_orders(terminal_id) WHERE terminal_id IS NOT NULL;
CREATE INDEX idx_pos_held_orders_created_at ON pos_held_orders(created_at DESC);
CREATE INDEX idx_pos_held_orders_expires_at ON pos_held_orders(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_pos_held_orders_hold_number ON pos_held_orders(hold_number);
CREATE INDEX idx_pos_held_orders_status ON pos_held_orders(status);

CREATE INDEX idx_pos_held_order_items_hold_id ON pos_held_order_items(hold_id);
CREATE INDEX idx_pos_held_order_items_product_id ON pos_held_order_items(product_id);
CREATE INDEX idx_pos_held_order_items_line_order ON pos_held_order_items(hold_id, line_order);

-- Sequence for hold numbers
CREATE SEQUENCE IF NOT EXISTS hold_number_seq START WITH 1;

-- Function to generate hold number
CREATE OR REPLACE FUNCTION generate_hold_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    current_year INTEGER;
    next_seq INTEGER;
    hold_num VARCHAR(50);
BEGIN
    current_year := EXTRACT(YEAR FROM NOW());
    next_seq := nextval('hold_number_seq');
    hold_num := 'HOLD-' || current_year || '-' || LPAD(next_seq::TEXT, 4, '0');
    RETURN hold_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate hold number
CREATE OR REPLACE FUNCTION set_hold_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hold_number IS NULL OR NEW.hold_number = '' THEN
        NEW.hold_number := generate_hold_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_hold_number
BEFORE INSERT ON pos_held_orders
FOR EACH ROW
EXECUTE FUNCTION set_hold_number();

-- Comments
COMMENT ON TABLE pos_held_orders IS 'Temporarily held POS carts - NOT invoices or sales';
COMMENT ON COLUMN pos_held_orders.terminal_id IS 'POS terminal/device identifier for multi-till support';
COMMENT ON COLUMN pos_held_orders.metadata IS 'Draft payment lines, cart-level discounts, etc.';
COMMENT ON COLUMN pos_held_orders.expires_at IS 'Optional expiration for auto-cleanup (default: 24 hours)';
COMMENT ON TABLE pos_held_order_items IS 'Line items for held orders - exact cart state';

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON inventory_batches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_po_updated_at BEFORE UPDATE ON purchase_orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_gr_updated_at BEFORE UPDATE ON goods_receipts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_customer_groups_updated_at BEFORE UPDATE ON customer_groups 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_pricing_tiers_updated_at BEFORE UPDATE ON pricing_tiers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_registers_updated_at BEFORE UPDATE ON cash_registers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON cash_register_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Default admin user (password: admin123)
-- Hash generated with bcrypt rounds=10
INSERT INTO users (email, password_hash, full_name, role) VALUES
('admin@digitalshop.com', '$2b$10$CDa/2yDxiwf9pqZFbWvJLuiPxlgOypZpTKi2HPRLbocTvebohBLWC', 'System Administrator', 'ADMIN');

-- Default customer groups
INSERT INTO customer_groups (name, description, discount_percentage) VALUES
('Retail Customers', 'Standard retail customers', 0.0000),
('Wholesale Customers', 'Bulk buyers with 10% discount', 0.1000);

-- Default cash register
INSERT INTO cash_registers (name, location) VALUES
('Main Register', 'Front Counter');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

SELECT 'DigitalShop database schema created successfully!' AS status;
SELECT COUNT(*) || ' tables created' AS result FROM information_schema.tables WHERE table_schema = 'public';
SELECT COUNT(*) || ' indexes created' AS result FROM pg_indexes WHERE schemaname = 'public';
