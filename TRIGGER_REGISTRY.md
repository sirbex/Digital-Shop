# DigitalShop — Trigger Registry

> **Enterprise Trigger Management** — inspired by SAP Data Dictionary (SE11) and Odoo `@api.depends`

| Property | Value |
|----------|-------|
| **Version** | 2.0 |
| **Last Updated** | 2026-03-20 |
| **Canonical File** | `DigitalShop-Shared/sql/02_triggers.sql` |
| **Total Functions** | 18 |
| **Total Triggers** | 35+ across 23 tables |

---

## Table of Contents

1. [Architecture Principles](#1-architecture-principles)
2. [Golden Rules](#2-golden-rules)
3. [Dependency Chain Map](#3-dependency-chain-map)
4. [Function Registry](#4-function-registry)
5. [Trigger Catalog](#5-trigger-catalog)
6. [Single Source of Truth Rules](#6-single-source-of-truth-rules)
7. [File Ownership Matrix](#7-file-ownership-matrix)
8. [Change Procedure](#8-change-procedure)
9. [Verification & Health Checks](#9-verification--health-checks)
10. [Troubleshooting Guide](#10-troubleshooting-guide)

---

## 1. Architecture Principles

### SAP-Inspired Design

| SAP Concept | Our Implementation |
|-------------|-------------------|
| **Data Dictionary (SE11)** | This document — central registry of all computed fields |
| **Update Rules** | `_internal()` functions — single place for each calculation |
| **Transport System** | `migrate.ts` — ordered execution of SQL files |
| **Consistency Check (SM21)** | `trigger_healthcheck.sql` — runtime data verification |
| **ABAP Dependencies** | Trigger dependency chain documented below |

### Odoo-Inspired Design

| Odoo Concept | Our Implementation |
|-------------|-------------------|
| **`@api.depends`** | Each trigger explicitly declares what tables it reads/writes |
| **`compute` methods** | `_internal()` functions = compute methods |
| **`store=True`** | All computed fields are stored in DB (not on-the-fly) |
| **`_sql_constraints`** | CHECK constraints in `01_schema.sql` |

### Design Pattern: Dispatcher → Internal

```
Child Table Change
    → Dispatcher (trigger function)
        → Extracts parent ID
        → Calls _internal(parent_id)
            → Queries source-of-truth table
            → Updates computed field on parent table
```

This 2-layer design lets us:
- Change calculation logic in one place (`_internal`)
- Attach multiple dispatchers for the same computed field
- Test `_internal` independently via `SELECT fn_update_xxx_internal(id)`

---

## 2. Golden Rules

### Rule 1: One File, One Truth
> All trigger functions live in `02_triggers.sql`. Migration files NEVER redefine functions.

### Rule 2: Dispatcher + Internal Pattern
> Every computed field uses a dispatcher trigger that calls an `_internal()` function.

### Rule 3: No Application-Layer Calculation
> Frontend and backend DISPLAY database-calculated values. They never compute totals, balances, or quantities.

### Rule 4: Idempotent Recalculation
> Every `_internal()` function recalculates from scratch (not incremental). Safe to call any time.

### Rule 5: Test Before,  Deploy After
> Run `trigger_healthcheck.sql` before AND after any trigger change to verify data consistency.

---

## 3. Dependency Chain Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TRIGGER DEPENDENCY CHAIN                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  sale_items ──INSERT/UPDATE/DELETE──► fn_recalculate_sale_totals    │
│                                          │                          │
│                                          ▼                          │
│                                   fn_update_sale_totals_internal    │
│                                          │                          │
│                                          ▼                          │
│                                   UPDATE sales                      │
│                                   (total, cost, profit, margin)     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  invoices ─────INSERT/UPDATE/DELETE─┐                               │
│  invoice_payments ─INSERT/UPD/DEL──┤► fn_recalculate_customer_bal  │
│  sales ────────INSERT/UPDATE/DELETE─┘     │                         │
│                                           ▼                         │
│                                   fn_update_customer_balance_int    │
│                                           │                         │
│                                           ▼                         │
│                               UPDATE customers.balance              │
│                               (= -SUM(unpaid invoice amount_due))   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  invoice_payments ─INSERT/UPD/DEL──► fn_recalculate_invoice_bal    │
│                                          │                          │
│                                          ▼                          │
│                                   fn_update_invoice_balance_int     │
│                                          │                          │
│                                          ▼                          │
│                                   UPDATE invoices                   │
│                                   (amount_paid, amount_due, status) │
│                                          │                          │
│                                          ▼ (fires next trigger)     │
│                             trg_sync_customer_balance_on_invoice    │
│                                          │                          │
│                                          ▼                          │
│                              UPDATE customers.balance               │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  purchase_orders ──INSERT/UPD/DEL──┐                                │
│  supplier_payments ─INSERT/UPD/DEL─┤► fn_update_supplier_bal_int   │
│                                    │      │                         │
│                                    │      ▼                         │
│                                    │  UPDATE suppliers.balance      │
│                                    │  (= purchases - payments)      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  inventory_batches ──INSERT/UPD/DEL──► fn_recalc_inventory_qty     │
│        │                                     │                      │
│        │                                     ▼                      │
│        │                          fn_update_inventory_qty_internal   │
│        │                                     │                      │
│        │                                     ▼                      │
│        │                          UPDATE products.quantity_on_hand   │
│        │                                                            │
│        └────INSERT/UPD/DEL──► fn_log_stock_movement                │
│                                     │                               │
│                                     ▼                               │
│                            INSERT stock_movements (audit trail)     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  purchase_order_items ──INS/UPD/DEL──► fn_recalc_po_totals        │
│                                             │                       │
│                                             ▼                       │
│                                   fn_update_po_totals_internal      │
│                                             │                       │
│                                             ▼                       │
│                                   UPDATE purchase_orders.total      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  goods_receipt_items ──INS/UPD/DEL──► fn_recalc_gr_totals         │
│                                            │                        │
│                                            ▼                        │
│                                   fn_update_gr_totals_internal      │
│                                            │                        │
│                                            ▼                        │
│                                   UPDATE goods_receipts.total       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

CASCADE CHAIN (invoice payment triggers TWO things):
  invoice_payments INSERT
    → trg_sync_invoice_balance → updates invoices.amount_due/status
        → trg_sync_customer_balance_on_invoice → updates customers.balance
    → trg_sync_customer_balance_on_payment → updates customers.balance (redundant but safe)
```

---

## 4. Function Registry

### Computation Functions (_internal)

| # | Function | Reads From | Writes To | Computation |
|---|----------|-----------|-----------|-------------|
| 1 | `fn_update_customer_balance_internal(id)` | `invoices` | `customers.balance` | `-SUM(amount_due)` WHERE status IN (DRAFT,SENT,PARTIALLY_PAID,OVERDUE) |
| 2 | `fn_update_supplier_balance_internal(id)` | `purchase_orders`, `supplier_payments` | `suppliers.balance` | `SUM(po.total)` WHERE RECEIVED/PARTIAL − `SUM(payments.amount)` |
| 3 | `fn_update_inventory_quantity_internal(id)` | `inventory_batches` | `products.quantity_on_hand` | `SUM(remaining_quantity)` WHERE status=ACTIVE |
| 4 | `fn_update_sale_totals_internal(id)` | `sale_items`, `sales` | `sales.*` | subtotal − discount + tax; profit = (subtotal−discount) − cost |
| 5 | `fn_update_po_totals_internal(id)` | `purchase_order_items` | `purchase_orders.total_amount` | `SUM(total_price)` |
| 6 | `fn_update_gr_totals_internal(id)` | `goods_receipt_items` | `goods_receipts.total_value` | `SUM(qty * cost_price)` |
| 7 | `fn_update_invoice_balance_internal(id)` | `invoice_payments` | `invoices.*` | amount_due = total − SUM(payments); auto-status |

### Dispatcher Functions (Trigger Entry Points)

| # | Function | Fires On Table | Events | Calls |
|---|----------|---------------|--------|-------|
| 1 | `fn_recalculate_customer_balance()` | sales, invoices, invoice_payments | INS/UPD/DEL | `fn_update_customer_balance_internal` |
| 2 | `fn_recalculate_supplier_balance()` | purchase_orders | INS/UPD/DEL | `fn_update_supplier_balance_internal` |
| 3 | `fn_recalculate_supplier_balance_on_payment()` | supplier_payments | INS/UPD/DEL | `fn_update_supplier_balance_internal` |
| 4 | `fn_recalculate_inventory_quantity()` | inventory_batches | INS/UPD/DEL | `fn_update_inventory_quantity_internal` |
| 5 | `fn_recalculate_sale_totals()` | sale_items | INS/UPD/DEL | `fn_update_sale_totals_internal` |
| 6 | `fn_recalculate_po_totals()` | purchase_order_items | INS/UPD/DEL | `fn_update_po_totals_internal` |
| 7 | `fn_recalculate_gr_totals()` | goods_receipt_items | INS/UPD/DEL | `fn_update_gr_totals_internal` |
| 8 | `fn_recalculate_invoice_balance()` | invoice_payments | INS/UPD/DEL | `fn_update_invoice_balance_internal` |
| 9 | `fn_log_stock_movement()` | inventory_batches | INS/UPD/DEL | INSERT → stock_movements |

### Utility Functions

| # | Function | Purpose |
|---|----------|---------|
| 1 | `update_updated_at_column()` | Auto-set `updated_at = NOW()` on UPDATE (13 tables) |
| 2 | `generate_movement_number()` | Generate SM-YYYY-###### for stock_movements |
| 3 | `generate_hold_number()` | Generate HOLD-YYYY-#### for POS held orders |
| 4 | `set_hold_number()` | Auto-populate hold_number on INSERT |
| 5 | `generate_expense_number()` | Generate EXP-YYYY-#### for expenses |
| 6 | `set_expense_number()` | Auto-populate expense_number on INSERT |
| 7 | `generate_quotation_number()` | Generate QT-YYYY-##### for quotations |
| 8 | `update_quotation_timestamp()` | Auto-set updated_at on quotation UPDATE |

---

## 5. Trigger Catalog

### Business Logic Triggers

| Trigger Name | Table | Timing | Events | Function |
|-------------|-------|--------|--------|----------|
| `trg_sync_customer_balance_on_sale` | sales | AFTER | INS/UPD/DEL | `fn_recalculate_customer_balance` |
| `trg_sync_customer_balance_on_payment` | invoice_payments | AFTER | INS/UPD/DEL | `fn_recalculate_customer_balance` |
| `trg_sync_customer_balance_on_invoice` | invoices | AFTER | INS/UPD/DEL | `fn_recalculate_customer_balance` |
| `trg_sync_supplier_balance` | purchase_orders | AFTER | INS/UPD/DEL | `fn_recalculate_supplier_balance` |
| `trg_sync_supplier_balance_on_payment` | supplier_payments | AFTER | INS/UPD/DEL | `fn_recalculate_supplier_balance_on_payment` |
| `trg_sync_inventory_quantity` | inventory_batches | AFTER | INS/UPD/DEL | `fn_recalculate_inventory_quantity` |
| `trg_log_stock_movement` | inventory_batches | AFTER | INS/UPD/DEL | `fn_log_stock_movement` |
| `trg_sync_sale_totals` | sale_items | AFTER | INS/UPD/DEL | `fn_recalculate_sale_totals` |
| `trg_sync_po_totals` | purchase_order_items | AFTER | INS/UPD/DEL | `fn_recalculate_po_totals` |
| `trg_sync_gr_totals` | goods_receipt_items | AFTER | INS/UPD/DEL | `fn_recalculate_gr_totals` |
| `trg_sync_invoice_balance` | invoice_payments | AFTER | INS/UPD/DEL | `fn_recalculate_invoice_balance` |

### Auto-Number Triggers

| Trigger Name | Table | Timing | Events | Function |
|-------------|-------|--------|--------|----------|
| `trg_set_hold_number` | pos_held_orders | BEFORE | INSERT | `set_hold_number` |
| `trg_set_expense_number` | expenses | BEFORE | INSERT | `set_expense_number` |
| `trg_quotation_number` | quotations | BEFORE | INSERT | `generate_quotation_number` |

### Timestamp Triggers (13 tables)

| Trigger Name | Table |
|-------------|-------|
| `update_users_updated_at` | users |
| `update_customers_updated_at` | customers |
| `update_suppliers_updated_at` | suppliers |
| `update_products_updated_at` | products |
| `update_batches_updated_at` | inventory_batches |
| `update_po_updated_at` | purchase_orders |
| `update_gr_updated_at` | goods_receipts |
| `update_invoices_updated_at` | invoices |
| `update_customer_groups_updated_at` | customer_groups |
| `update_pricing_tiers_updated_at` | pricing_tiers |
| `update_registers_updated_at` | cash_registers |
| `update_sessions_updated_at` | cash_register_sessions |
| `update_expenses_updated_at` | expenses |
| `update_roles_updated_at` | roles |
| `update_system_settings_updated_at` | system_settings |

---

## 6. Single Source of Truth Rules

These rules are **non-negotiable**. Violating them causes data inconsistency.

| Computed Field | Source of Truth | Derivation | NEVER Do This |
|---------------|----------------|------------|---------------|
| `customers.balance` | `invoices.amount_due` | `-SUM(amount_due)` for unpaid invoices | Direct UPDATE to customers.balance |
| `products.quantity_on_hand` | `inventory_batches.remaining_quantity` | `SUM(remaining_qty)` for ACTIVE batches | Direct UPDATE when batch exists |
| `invoices.amount_paid` | `invoice_payments.amount` | `SUM(amount)` for invoice | Direct UPDATE to invoices.amount_paid |
| `invoices.amount_due` | `invoices.total_amount` - payments | `total - SUM(payments)` | Set amount_due without trigger recalc |
| `suppliers.balance` | `purchase_orders` + `supplier_payments` | `SUM(po.total) - SUM(payments)` | Direct UPDATE to suppliers.balance |
| `sales.total_amount` | `sale_items` + `sales.tax_amount` | `SUM(qty*price) - discount + tax` | Direct UPDATE to sales.total_amount |
| `sales.profit` | `sale_items` costs | `(subtotal - discount) - cost` | Include tax in profit |
| `purchase_orders.total_amount` | `purchase_order_items.total_price` | `SUM(total_price)` | Direct UPDATE |
| `goods_receipts.total_value` | `goods_receipt_items` | `SUM(qty * cost_price)` | Direct UPDATE |

---

## 7. File Ownership Matrix

| File | Owns | Does NOT Own |
|------|------|-------------|
| `01_schema.sql` | Tables, constraints, indexes, enums, `update_updated_at_column()`, `generate_hold_number()`, `set_hold_number()` | Business logic functions |
| **`02_triggers.sql`** | **ALL business trigger functions** (18 functions, all dispatchers + internals) | Table definitions |
| `05_expenses.sql` | expenses table, `generate_expense_number()`, `set_expense_number()` | Trigger function logic |
| `08_supplier_payments.sql` | supplier_payments table, trigger ATTACHMENT only | `fn_update_supplier_balance_internal` (lives in 02) |
| `10_quotations.sql` | quotations table, `generate_quotation_number()`, `update_quotation_timestamp()` | Business logic |
| `fix_po_status.sql` | **EMPTY** (historical reference only) | Nothing — consolidated into 02 |
| `fix_profit_discount.sql` | **EMPTY** (historical reference only) | Nothing — consolidated into 02 |
| `fix_updated_at.sql` | `update_updated_at_column()` redefinition + extra trigger attachments | Business logic |

---

## 8. Change Procedure

### How to Modify a Trigger (Step by Step)

```
1. IDENTIFY    → Find the _internal() function in 02_triggers.sql
2. HEALTHCHECK → Run trigger_healthcheck.sql BEFORE changes
3. MODIFY      → Edit ONLY in 02_triggers.sql
4. TEST LOCAL  → psql -f 02_triggers.sql on local DB
5. HEALTHCHECK → Run trigger_healthcheck.sql AFTER changes
6. COMMIT      → git commit with clear message
7. DEPLOY      → Push to Railway (migrate.ts re-runs 02_triggers.sql)
```

### How to Add a New Computed Field

```
1. ADD COLUMN  → In 01_schema.sql (or ALTER TABLE migration)
2. CREATE _internal() → In 02_triggers.sql
3. CREATE dispatcher → In 02_triggers.sql
4. ATTACH trigger → In 02_triggers.sql (or migration if table is new)
5. UPDATE this doc → Add to Function Registry + Trigger Catalog
6. ADD healthcheck → Add verification query to trigger_healthcheck.sql
```

### How to Add a New Table with Triggers

```
1. CREATE TABLE → In a new migration file (XX_tablename.sql)
2. DEFINE functions → In 02_triggers.sql (even if table doesn't exist yet)
3. ATTACH trigger → In the migration file (after CREATE TABLE)
4. UPDATE this doc → Add to all relevant tables above
```

---

## 9. Verification & Health Checks

### Quick Verification (run after ANY trigger change)

```sql
-- Verify all functions exist
SELECT proname FROM pg_proc 
WHERE proname LIKE 'fn_%' AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- Verify all triggers are attached
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public' AND trigger_name LIKE 'trg_%'
ORDER BY event_object_table;
```

### Full Health Check

Run `DigitalShop-Shared/sql/trigger_healthcheck.sql` — validates:
- Customer balances match invoice aggregation
- Product quantities match batch aggregation
- Invoice balances match payment aggregation
- Supplier balances match PO − payment aggregation
- Sale totals match item aggregation

---

## 10. Troubleshooting Guide

### Problem: Customer balance is wrong
```sql
-- Diagnose
SELECT c.id, c.name, c.balance,
  -COALESCE(SUM(i.amount_due), 0) as expected_balance
FROM customers c
LEFT JOIN invoices i ON i.customer_id = c.id 
  AND i.status IN ('DRAFT','SENT','PARTIALLY_PAID','OVERDUE')
GROUP BY c.id HAVING c.balance != -COALESCE(SUM(i.amount_due), 0);

-- Fix: recalculate one customer
SELECT fn_update_customer_balance_internal('customer-uuid-here');

-- Fix: recalculate ALL customers
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM customers LOOP
    PERFORM fn_update_customer_balance_internal(r.id);
  END LOOP;
END $$;
```

### Problem: Product quantity doesn't match batches
```sql
-- Diagnose
SELECT p.id, p.name, p.quantity_on_hand,
  COALESCE(SUM(ib.remaining_quantity), 0) as expected_qty
FROM products p
LEFT JOIN inventory_batches ib ON ib.product_id = p.id AND ib.status = 'ACTIVE'
GROUP BY p.id HAVING p.quantity_on_hand != COALESCE(SUM(ib.remaining_quantity), 0);

-- Fix: recalculate ALL products
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM products LOOP
    PERFORM fn_update_inventory_quantity_internal(r.id);
  END LOOP;
END $$;
```

### Problem: Supplier balance incorrect
```sql
-- Diagnose
SELECT s.id, s.name, s.balance,
  COALESCE(po_sum.total, 0) - COALESCE(pay_sum.total, 0) as expected
FROM suppliers s
LEFT JOIN (SELECT supplier_id, SUM(total_amount) total FROM purchase_orders 
           WHERE status IN ('RECEIVED','PARTIAL') GROUP BY supplier_id) po_sum ON po_sum.supplier_id = s.id
LEFT JOIN (SELECT supplier_id, SUM(amount) total FROM supplier_payments 
           GROUP BY supplier_id) pay_sum ON pay_sum.supplier_id = s.id
WHERE s.balance != COALESCE(po_sum.total, 0) - COALESCE(pay_sum.total, 0);

-- Fix: recalculate ALL suppliers
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM suppliers LOOP
    PERFORM fn_update_supplier_balance_internal(r.id);
  END LOOP;
END $$;
```

### Problem: Invoice shows wrong paid amount
```sql
-- Diagnose
SELECT i.id, i.invoice_number, i.amount_paid,
  COALESCE(SUM(ip.amount), 0) as expected_paid
FROM invoices i
LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id
GROUP BY i.id HAVING i.amount_paid != COALESCE(SUM(ip.amount), 0);

-- Fix: recalculate ALL invoices
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM invoices LOOP
    PERFORM fn_update_invoice_balance_internal(r.id);
  END LOOP;
END $$;
```

---

## Appendix: Migration Execution Order

```
migrate.ts runs these in order on server startup:
  1. 05_add_refunds_tables.sql   (tables only)
  2. 05_expenses.sql             (table + expense number functions)
  3. 05_rbac_roles_permissions.sql (tables only)
  4. 06_system_settings.sql      (table only)
  5. 07_custom_sale_items.sql    (ALTER TABLE only)
  6. 08_supplier_payments.sql    (table + trigger ATTACHMENT only)
  7. 09_check_payments.sql       (ALTER TABLE only)
  8. 10_quotations.sql           (table + quotation functions)
  9. fix_po_status.sql           (empty — historical)
 10. fix_profit_discount.sql     (empty — historical)
 11. fix_seed.sql                (seed data)
 12. fix_updated_at.sql          (utility function + trigger attachments)
```

**Base files** (run manually on fresh DB setup):
- `01_schema.sql` → All tables, constraints, indexes
- `02_triggers.sql` → ALL trigger functions (Single Source of Truth)
- `03_seed.sql` → Default data
