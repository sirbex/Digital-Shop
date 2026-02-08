-- ============================================================================
-- DIGITALSHOP RBAC: ROLES & PERMISSIONS
-- ============================================================================
-- Role-based access control with permission catalog
-- Migration: 05_rbac_roles_permissions.sql
-- ============================================================================

-- ============================================================================
-- 1. ROLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active) WHERE is_active = true;

COMMENT ON TABLE roles IS 'RBAC roles with permission assignments';
COMMENT ON COLUMN roles.is_system_role IS 'System roles cannot be edited or deleted';

-- ============================================================================
-- 2. PERMISSIONS CATALOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissions (
    key VARCHAR(100) PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

COMMENT ON TABLE permissions IS 'Permission catalog — all available permission keys';

-- ============================================================================
-- 3. ROLE_PERMISSIONS JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_role_permission UNIQUE (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_key);

COMMENT ON TABLE role_permissions IS 'Many-to-many junction between roles and permissions';

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. SEED: PERMISSION CATALOG
-- ============================================================================

INSERT INTO permissions (key, module, action, description) VALUES
    -- Sales
    ('sales.read',       'sales',     'read',     'View sales and transactions'),
    ('sales.create',     'sales',     'create',   'Create new sales'),
    ('sales.void',       'sales',     'void',     'Void completed sales'),
    ('sales.refund',     'sales',     'refund',   'Process refunds'),
    ('sales.export',     'sales',     'export',   'Export sales data'),
    ('sales.viewProfit', 'sales',     'viewProfit','View profit and cost data on sales'),
    
    -- Products
    ('products.read',    'products',  'read',     'View products catalog'),
    ('products.create',  'products',  'create',   'Create new products'),
    ('products.update',  'products',  'update',   'Edit product details'),
    ('products.delete',  'products',  'delete',   'Deactivate products'),
    ('products.viewCost','products',  'viewCost', 'View cost price and margins'),
    ('products.import',  'products',  'import',   'Import products from file'),
    ('products.export',  'products',  'export',   'Export products to file'),
    
    -- Inventory (granular per sub-page)
    ('inventory.read',         'inventory', 'read',         'View stock levels overview'),
    ('inventory.batches',      'inventory', 'batches',      'View inventory batches and expiry'),
    ('inventory.movements',    'inventory', 'movements',    'View stock movement history'),
    ('inventory.adjust',       'inventory', 'adjust',       'Create stock adjustments'),
    ('inventory.approve',      'inventory', 'approve',      'Approve or reject stock adjustments'),
    ('inventory.valuation',    'inventory', 'valuation',    'View inventory valuation data'),
    
    -- Customers
    ('customers.read',   'customers', 'read',     'View customer list'),
    ('customers.create', 'customers', 'create',   'Create new customers'),
    ('customers.update', 'customers', 'update',   'Edit customer details'),
    ('customers.delete', 'customers', 'delete',   'Deactivate customers'),
    ('customers.viewBalance','customers','viewBalance','View customer balances and credit'),
    
    -- Suppliers
    ('suppliers.read',   'suppliers', 'read',     'View supplier list'),
    ('suppliers.create', 'suppliers', 'create',   'Create new suppliers'),
    ('suppliers.update', 'suppliers', 'update',   'Edit supplier details'),
    ('suppliers.delete', 'suppliers', 'delete',   'Deactivate suppliers'),
    
    -- Purchases & Goods Receipts
    ('purchases.read',   'purchases', 'read',     'View purchase orders'),
    ('purchases.create', 'purchases', 'create',   'Create purchase orders'),
    ('purchases.update', 'purchases', 'update',   'Edit draft purchase orders'),
    ('purchases.approve','purchases', 'approve',  'Submit and approve purchase orders'),
    ('purchases.delete', 'purchases', 'delete',   'Cancel and delete purchase orders'),
    ('purchases.receive','purchases', 'receive',  'Receive goods and create goods receipts'),
    ('purchases.viewGR', 'purchases', 'viewGR',   'View goods receipt history'),
    
    -- Invoices
    ('invoices.read',    'invoices',  'read',     'View invoices'),
    ('invoices.create',  'invoices',  'create',   'Create invoices'),
    ('invoices.payment', 'invoices',  'payment',  'Record invoice payments'),
    
    -- Expenses
    ('expenses.read',    'expenses',  'read',     'View expenses'),
    ('expenses.create',  'expenses',  'create',   'Create expenses'),
    ('expenses.update',  'expenses',  'update',   'Edit expenses'),
    ('expenses.delete',  'expenses',  'delete',   'Delete expenses'),
    ('expenses.approve', 'expenses',  'approve',  'Approve expense entries'),
    
    -- Reports (granular per category)
    ('reports.sales',       'reports', 'sales',       'View sales reports (daily, summary, trends)'),
    ('reports.inventory',   'reports', 'inventory',   'View inventory reports (stock, valuation, expiry)'),
    ('reports.financial',   'reports', 'financial',   'View financial reports (P&L, income vs expense)'),
    ('reports.customers',   'reports', 'customers',   'View customer reports (aging, accounts)'),
    ('reports.expenses',    'reports', 'expenses',    'View expense reports (summary, by category)'),
    ('reports.discounts',   'reports', 'discounts',   'View discount reports (by cashier, totals)'),
    ('reports.invoices',    'reports', 'invoices',    'View invoice and refund reports'),
    ('reports.export',      'reports', 'export',      'Export reports to PDF/CSV'),
    
    -- Users
    ('users.read',       'users',     'read',     'View user list'),
    ('users.create',     'users',     'create',   'Create new users'),
    ('users.update',     'users',     'update',   'Edit user details'),
    ('users.delete',     'users',     'delete',   'Deactivate users'),
    
    -- Settings / System
    ('settings.read',    'settings',  'read',     'View system settings'),
    ('settings.update',  'settings',  'update',   'Modify system settings'),
    ('settings.roles',   'settings',  'roles',    'Manage roles and permissions'),
    ('settings.reset',   'settings',  'reset',    'Execute data reset'),
    
    -- POS
    ('pos.access',       'pos',       'access',   'Access the POS terminal'),
    ('pos.hold',         'pos',       'hold',     'Hold and recall orders'),
    ('pos.discount',     'pos',       'discount', 'Apply item-level discounts at POS'),
    ('pos.cartDiscount', 'pos',       'cartDiscount','Apply cart-level (whole order) discounts'),
    ('pos.priceOverride','pos',       'priceOverride','Override product selling price at POS'),
    ('pos.creditSale',   'pos',       'creditSale','Process credit sales (on-account)'),
    
    -- Discounts (standalone module for visibility/management)
    ('discounts.view',     'discounts', 'view',     'View discount history and totals'),
    ('discounts.apply',    'discounts', 'apply',    'Apply discounts on sales'),
    ('discounts.unlimited','discounts', 'unlimited','Apply discounts without a limit'),
    
    -- Cash Register
    ('cashregister.open',  'cashregister', 'open',  'Open cash register session'),
    ('cashregister.close', 'cashregister', 'close', 'Close cash register session'),
    ('cashregister.movement','cashregister','movement','Record cash movements'),
    ('cashregister.view',  'cashregister', 'view',  'View cash register sessions and history')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 6. SEED: DEFAULT ROLES
-- ============================================================================

-- Administrator (all permissions)
INSERT INTO roles (id, name, description, is_system_role) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Administrator', 'Full system access — all permissions granted', true)
ON CONFLICT (name) DO NOTHING;

-- Manager
INSERT INTO roles (id, name, description, is_system_role) VALUES
    ('00000000-0000-0000-0000-000000000002', 'Manager', 'Store management — sales, inventory, reports, and staff oversight', true)
ON CONFLICT (name) DO NOTHING;

-- Cashier
INSERT INTO roles (id, name, description, is_system_role) VALUES
    ('00000000-0000-0000-0000-000000000003', 'Cashier', 'POS operations — process sales and handle payments', true)
ON CONFLICT (name) DO NOTHING;

-- Staff
INSERT INTO roles (id, name, description, is_system_role) VALUES
    ('00000000-0000-0000-0000-000000000004', 'Staff', 'Basic access — view products, customers, and inventory', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 7. SEED: ROLE → PERMISSION ASSIGNMENTS
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- Administrator: ALL permissions (full unrestricted access)
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_key)
SELECT '00000000-0000-0000-0000-000000000001', key FROM permissions
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- Manager: Full operational access EXCEPT system-critical settings
-- Cannot: modify system settings, manage roles, reset data, create/delete users
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_key)
SELECT '00000000-0000-0000-0000-000000000002', key FROM permissions
WHERE key NOT IN (
    'settings.update',
    'settings.roles',
    'settings.reset',
    'users.create',
    'users.delete',
    'discounts.unlimited'    -- Managers still have a discount cap
)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- Cashier: POS operations, basic sales, limited reads
-- Can: sell, apply item discounts, view products/customers/inventory, open register
-- Cannot: void sales, apply cart discounts, view cost/profit, access reports,
--         manage inventory/purchases/users/settings, price override, credit sales
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_key) VALUES
    -- POS access
    ('00000000-0000-0000-0000-000000000003', 'pos.access'),
    ('00000000-0000-0000-0000-000000000003', 'pos.hold'),
    ('00000000-0000-0000-0000-000000000003', 'pos.discount'),           -- Item discount only
    -- Sales (create & view own)
    ('00000000-0000-0000-0000-000000000003', 'sales.read'),
    ('00000000-0000-0000-0000-000000000003', 'sales.create'),
    -- Discounts (basic apply)
    ('00000000-0000-0000-0000-000000000003', 'discounts.apply'),
    -- Products (read-only)
    ('00000000-0000-0000-0000-000000000003', 'products.read'),
    -- Customers (read + quick-create at POS)
    ('00000000-0000-0000-0000-000000000003', 'customers.read'),
    ('00000000-0000-0000-0000-000000000003', 'customers.create'),
    -- Inventory (stock levels only — no batches, movements, adjustments)
    ('00000000-0000-0000-0000-000000000003', 'inventory.read'),
    -- Invoices (read + record payment at POS)
    ('00000000-0000-0000-0000-000000000003', 'invoices.read'),
    ('00000000-0000-0000-0000-000000000003', 'invoices.payment'),
    -- Cash register
    ('00000000-0000-0000-0000-000000000003', 'cashregister.open'),
    ('00000000-0000-0000-0000-000000000003', 'cashregister.close'),
    ('00000000-0000-0000-0000-000000000003', 'cashregister.movement'),
    ('00000000-0000-0000-0000-000000000003', 'cashregister.view')
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- Staff: Read-only access + limited inventory visibility
-- Can: view products, customers, suppliers, stock levels, sales, invoices, POs
-- Cannot: create/edit anything, access POS, access reports, view cost/profit
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_key) VALUES
    ('00000000-0000-0000-0000-000000000004', 'products.read'),
    ('00000000-0000-0000-0000-000000000004', 'customers.read'),
    ('00000000-0000-0000-0000-000000000004', 'suppliers.read'),
    ('00000000-0000-0000-0000-000000000004', 'inventory.read'),
    ('00000000-0000-0000-0000-000000000004', 'inventory.batches'),
    ('00000000-0000-0000-0000-000000000004', 'sales.read'),
    ('00000000-0000-0000-0000-000000000004', 'invoices.read'),
    ('00000000-0000-0000-0000-000000000004', 'purchases.read'),
    ('00000000-0000-0000-0000-000000000004', 'purchases.viewGR')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'RBAC tables created successfully!' AS status;
SELECT COUNT(*) || ' permissions seeded' AS result FROM permissions;
SELECT r.name, COUNT(rp.id) AS permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.name
ORDER BY permission_count DESC;
