# DigitalShop AI Agent Instructions

## 🧠 Copilot Global Architecture Contract

Enterprise ERP — Schema, Validation, and UI Synchronization

---

### 🎯 Purpose
Maintain bank-grade consistency across the entire stack:
- Database schema and migrations (PostgreSQL via raw SQL)
- Backend models/DTOs and API endpoints (Node.js + Express)
- Shared validation (Zod)
- Frontend forms, popups, selectors, and tables (React)

Scope applies to all entities: Products, Customers, Suppliers, Sales, Invoices, GoodsReceipts, PurchaseOrders, Accounts, etc.

Copilot must apply this contract automatically across the system — never limit logic to a single module.

---

### 1️⃣ Global Schema Synchronization

Whenever a new field or entity is introduced or modified, Copilot MUST propagate the change to ALL layers:

- **Database schema (RAW SQL ONLY)**
  - Location: `DigitalShop-Shared/sql/` (manual SQL migration scripts)
  - Policy: No ORM. Never use Prisma/Sequelize/TypeORM.
- **Shared Types**
  - Location: `DigitalShop-Shared/types/*.ts`
- **Validation Schemas (Zod)**
  - Location: `DigitalShop-Shared/zod/{entity}.ts`
- **Backend DTOs and Controllers**
  - Location: `DigitalShop-Backend/src/modules/**` (controller → service → repository)
  - Repositories use parameterized SQL only
- **Frontend UI**
  - Update models, forms, popups/modals, selectors, list/table columns wherever the entity appears

**Naming convention:**
- Database: `snake_case`
- API/TypeScript: `camelCase`
- Display labels: Title Case

**Propagation Rule:**
> One schema change = automatic ripple update across backend + validation + frontend.

Never ship a change that exists in only one layer.

---

### 2️⃣ Validation Discipline (Zod‑First)

Each entity has a single shared Zod schema used systemwide:

```
DigitalShop-Shared/zod/{entity}.ts
```

**Rules:**
- Use the SAME schema for both backend and frontend validation
- Never redefine the same validation rule twice in different places
- Infer TypeScript types from Zod to ensure type safety

**Example:**

```ts
import { z } from 'zod';

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  sku: z.string().min(1).max(100),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  trackExpiry: z.boolean().default(false),
  // ...other fields...
}).strict();

export type Product = z.infer<typeof ProductSchema>;
```

**Backend usage (controller example):**

```ts
// Controller: validate request with shared Zod schema
try {
  const input = CreateProductSchema.parse(req.body);
  const data = await productService.create(input);
  res.json({ success: true, data });
} catch (err: any) {
  res.status(400).json({ success: false, error: err.message });
}
```

**Frontend usage (form example):**

```ts
// Import shared schema and infer types for form
import { CreateProductSchema } from '@/shared/zod/product';
type CreateProduct = z.infer<typeof CreateProductSchema>;
```

---

### 3️⃣ API Response Contract (Non‑Negotiable)

All endpoints must return the exact shape below. Frontend depends on it.

```json
// Success
{ "success": true, "data": { /* result */ }, "message": "Operation successful" }

// Error
{ "success": false, "error": "Descriptive error message" }
```

---

### 4️⃣ Architectural Guardrails (Enforced)

- **No ORM** (Prisma/Sequelize/TypeORM) — repositories use parameterized SQL
- **Strict layering**: Controller → Service → Repository (SQL only)
- **No business logic in repositories**; no DB access outside repositories
- **Decimal.js** for currency/quantity arithmetic (never native floats for money)
- **Database-First Design**: ALL business logic lives in PostgreSQL triggers

---

### 5️⃣ Single Source of Truth for Financial Data (CRITICAL)

**Invoices are THE authoritative source for all credit/outstanding amounts.**

#### Customer Balance Rules

1. **NEVER directly update `customers.balance`** - it is managed by database triggers
2. **Balance direction**:
   - Negative balance = Customer owes us (accounts receivable)
   - Positive balance = We owe customer (prepaid/credit)
3. **Trigger chain**: `invoice_payments` INSERT → `trg_sync_invoice_balance` → updates `invoices.amount_due` → `trg_sync_customer_balance_on_invoice` → recalculates `customers.balance`

#### Credit Outstanding Calculation (MANDATORY)

```sql
-- CORRECT: Use invoices table as single source
SELECT COALESCE(SUM(amount_due), 0) as total_credit_outstanding
FROM invoices
WHERE customer_id = $1
  AND status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE');

-- WRONG: Do NOT calculate from sales table
-- SELECT SUM(total_amount - amount_paid) FROM sales WHERE payment_method = 'CREDIT'
```

#### When Processing Refunds

```typescript
// CORRECT: Update invoice, let trigger update customer balance
await updateInvoiceForRefund(pool, invoiceId, refundAmount);

// WRONG: Direct balance manipulation bypasses triggers
// await pool.query('UPDATE customers SET balance = balance + $1', [amount]);
```

#### Reports & Summaries

All reports querying credit outstanding MUST use `invoices` table:
- `getSalesSummary()` → Query `invoices.amount_due`
- `getCustomerAgingReport()` → Query `invoices.amount_due` with aging buckets
- `getProfitLossReport()` → Credit sales from `invoices`

---

### 6️⃣ Single Source of Truth for Inventory Data (CRITICAL)

**Inventory batches are THE authoritative source for product quantities.**

#### Inventory Quantity Rules

1. **When batch is involved**: Update `inventory_batches.remaining_quantity` ONLY - trigger automatically updates `products.quantity_on_hand`
2. **When NO batch involved**: Direct update to `products.quantity_on_hand` is acceptable
3. **Never update BOTH** - causes double counting

#### Correct Patterns

```typescript
// CORRECT: Sale with batch - update batch only
if (item.batchId) {
  await pool.query(
    'UPDATE inventory_batches SET remaining_quantity = remaining_quantity - $1 WHERE id = $2',
    [item.quantity, item.batchId]
  );
  // Trigger handles products.quantity_on_hand automatically
}

// CORRECT: Adjustment without batch - update product directly
if (!data.batchId) {
  await pool.query(
    'UPDATE products SET quantity_on_hand = quantity_on_hand + $1 WHERE id = $2',
    [adjustment, productId]
  );
}

// WRONG: Updating both batch AND product directly
await pool.query('UPDATE inventory_batches SET remaining_quantity = ...');
await pool.query('UPDATE products SET quantity_on_hand = ...'); // REDUNDANT!
```

#### Trigger Flow
`inventory_batches` INSERT/UPDATE → `trg_sync_inventory_quantity` → recalculates `products.quantity_on_hand` from all ACTIVE batches

---

### 7️⃣ FEFO Multi-Batch Deduction (CRITICAL FOR POS)

**Sales may span multiple batches when a single batch doesn't have enough stock.**

#### BULLETPROOF Sale Inventory Flow

1. **Service Layer Validation** (`salesService.ts`):
   - Validate all item quantities > 0
   - Aggregate quantities by product (same product may appear multiple times)
   - Query total available stock (SUM of batch remaining_qty OR quantity_on_hand)
   - REJECT sale if ANY product has insufficient stock

2. **Repository Layer Deduction** (`salesRepository.ts`):
   - Lock batches with `FOR UPDATE` to prevent concurrent modification
   - Deduct from multiple batches in FEFO order (First Expiry First Out)
   - Use `GREATEST(0, remaining_quantity - $1)` to prevent negative values
   - Use `WHERE remaining_quantity >= $1` to ensure atomic safety
   - Rollback transaction if full quantity cannot be allocated

#### Correct Multi-Batch Deduction

```typescript
// CORRECT: FEFO multi-batch deduction with safety checks
let remainingToDeduct = item.quantity;

const batchesQuery = `
  SELECT id, remaining_quantity, expiry_date
  FROM inventory_batches
  WHERE product_id = $1 AND status = 'ACTIVE' AND remaining_quantity > 0
  ORDER BY 
    CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
    expiry_date ASC,
    received_date ASC
  FOR UPDATE  -- Lock rows to prevent concurrent modification
`;

for (const batch of batches) {
  if (remainingToDeduct <= 0) break;
  
  const deductFromThisBatch = Math.min(remainingToDeduct, batch.remaining_quantity);
  
  // Safe update with constraint check
  await client.query(`
    UPDATE inventory_batches
    SET remaining_quantity = GREATEST(0, remaining_quantity - $1),
        status = CASE WHEN remaining_quantity - $1 <= 0 THEN 'DEPLETED' ELSE status END
    WHERE id = $2 AND remaining_quantity >= $1
  `, [deductFromThisBatch, batch.id]);
  
  remainingToDeduct -= deductFromThisBatch;
}

// SAFETY: Rollback if we couldn't deduct everything
if (remainingToDeduct > 0.001) {
  throw new Error('Unable to allocate full inventory');
}
```

#### WRONG: Single batch deduction (CAUSES chk_batch_remaining VIOLATION)

```typescript
// WRONG: Only selecting one batch - fails when that batch has less than needed
const batch = await client.query(`
  SELECT id FROM inventory_batches WHERE product_id = $1 LIMIT 1
`);
await client.query(
  'UPDATE inventory_batches SET remaining_quantity = remaining_quantity - $1 WHERE id = $2',
  [item.quantity, batch.id]  // FAILS if batch.remaining_quantity < item.quantity
);

// WRONG: Updating both batch AND product directly
await pool.query('UPDATE inventory_batches SET remaining_quantity = ...');
await pool.query('UPDATE products SET quantity_on_hand = ...'); // REDUNDANT!
```

#### Trigger Flow
`inventory_batches` INSERT/UPDATE → `trg_sync_inventory_quantity` → recalculates `products.quantity_on_hand` from all ACTIVE batches

---

### 8️⃣ Duplicate Prevention Patterns (CRITICAL)

**NEVER create duplicate entities. Always check for existing records before INSERT.**

#### Products: SKU and Barcode Uniqueness

```typescript
// CORRECT: Check before creating product (productsService.ts)
export async function createProduct(pool: Pool, data: CreateProductData): Promise<Product> {
  // Check SKU uniqueness
  const existingSku = await productsRepository.getProductBySku(pool, data.sku);
  if (existingSku) {
    throw new Error('SKU already exists');
  }

  // Check barcode uniqueness (if provided)
  if (data.barcode) {
    const existingBarcode = await productsRepository.getProductByBarcode(pool, data.barcode);
    if (existingBarcode) {
      throw new Error('Barcode already exists');
    }
  }

  // Now safe to create
  return await productsRepository.createProduct(pool, data);
}

// CORRECT: Check on update too (excluding current record)
export async function updateProduct(pool: Pool, id: string, data: UpdateProductData): Promise<Product> {
  if (data.sku) {
    const existingSku = await productsRepository.getProductBySku(pool, data.sku);
    if (existingSku && existingSku.id !== id) {
      throw new Error('SKU already exists');
    }
  }
  // ... same for barcode
}
```

#### Customers: Phone and Email Uniqueness

```typescript
// CORRECT: Check before creating customer (customersService.ts)
export async function createCustomer(pool: Pool, data: CreateCustomerData): Promise<Customer> {
  // Check phone uniqueness (if provided)
  if (data.phone) {
    const existingByPhone = await customersRepository.getCustomerByPhone(pool, data.phone);
    if (existingByPhone) {
      throw new Error(`A customer with phone number "${data.phone}" already exists: ${existingByPhone.name}`);
    }
  }

  // Check email uniqueness (if provided)
  if (data.email) {
    const existingByEmail = await customersRepository.getCustomerByEmail(pool, data.email);
    if (existingByEmail) {
      throw new Error(`A customer with email "${data.email}" already exists: ${existingByEmail.name}`);
    }
  }

  // Now safe to create
  return await customersRepository.createCustomer(pool, data);
}

// CORRECT: Check on update (excluding current record by ID)
export async function updateCustomer(pool: Pool, id: string, data: UpdateCustomerData): Promise<Customer> {
  if (data.phone) {
    const existingByPhone = await customersRepository.getCustomerByPhone(pool, data.phone, id);
    if (existingByPhone) {
      throw new Error(`A customer with phone number "${data.phone}" already exists`);
    }
  }
  // ... same for email with excludeId parameter
}
```

#### Suppliers: Phone and Email Uniqueness

```typescript
// CORRECT: Same pattern as customers (suppliersService.ts)
export async function createSupplier(pool: Pool, data: CreateSupplierData): Promise<Supplier> {
  if (data.phone) {
    const existingByPhone = await suppliersRepository.getSupplierByPhone(pool, data.phone);
    if (existingByPhone) {
      throw new Error(`A supplier with phone number "${data.phone}" already exists: ${existingByPhone.name}`);
    }
  }

  if (data.email) {
    const existingByEmail = await suppliersRepository.getSupplierByEmail(pool, data.email);
    if (existingByEmail) {
      throw new Error(`A supplier with email "${data.email}" already exists: ${existingByEmail.name}`);
    }
  }

  return await suppliersRepository.createSupplier(pool, data);
}
```

#### Repository Helper Functions Pattern

```typescript
// CORRECT: Repository function with excludeId for update operations
export async function getCustomerByPhone(pool: Pool, phone: string, excludeId?: string): Promise<CustomerRow | null> {
  let query = `SELECT * FROM customers WHERE phone = $1 AND is_active = true`;
  const values: any[] = [phone];

  if (excludeId) {
    query += ` AND id != $2`;
    values.push(excludeId);
  }
  query += ` LIMIT 1`;

  const result = await pool.query<CustomerRow>(query, values);
  return result.rows[0] || null;
}
```

#### Key Duplicate Prevention Rules

1. **ALWAYS check at Service layer** - Repository is for data access only
2. **Include excludeId parameter** for update operations to exclude current record
3. **Provide helpful error messages** - Include the conflicting name/value
4. **Check ONLY active records** - `is_active = true` to allow reusing soft-deleted entries
5. **Case-insensitive email check** - Use `LOWER(email) = LOWER($1)`

#### WRONG: No duplicate checking

```typescript
// WRONG: Direct insert without checking - causes user confusion
export async function createCustomer(pool: Pool, data: CreateCustomerData): Promise<Customer> {
  return await customersRepository.createCustomer(pool, data);
  // User can create duplicate phone/email entries!
}
```

---

## Project Overview
DigitalShop is an enterprise Point of Sale (POS), inventory management, and reporting system with:
- **Backend**: Express.js + TypeScript + PostgreSQL (port 8340)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS (port 5030)
- **Database**: PostgreSQL 14+ with 20 tables, critical business logic in triggers

## Critical Architecture Principles

### 1. Database-First Design
**ALL business logic lives in PostgreSQL triggers** ([DigitalShop-Shared/sql/02_triggers.sql](../DigitalShop-Shared/sql/02_triggers.sql)). The frontend displays database-calculated values—never performs its own calculations.

**Critical triggers:**
- Tax calculation (preserved from sales table)
- Customer balance recalculation (from credit sales and payments)
- Stock movement tracking (FIFO/AVCO costing)
- Automatic numbering (sale numbers, movement numbers)

**When modifying sales/inventory/pricing logic**: Update triggers, not application code.

### 2. Module Structure (Backend)
Each feature module in `DigitalShop-Backend/src/modules/` follows a strict 4-layer pattern:

```
modules/
  {feature}/
    {feature}Routes.ts      # Express routes + auth middleware
    {feature}Controller.ts  # HTTP handlers + Zod validation
    {feature}Service.ts     # Business logic + type interfaces
    {feature}Repository.ts  # Database queries (raw SQL)
```

**Example**: For sales module, database query is in [salesRepository.ts](../DigitalShop-Backend/src/modules/sales/salesRepository.ts), calculations/logic in [salesService.ts](../DigitalShop-Backend/src/modules/sales/salesService.ts), HTTP handling in [salesController.ts](../DigitalShop-Backend/src/modules/sales/salesController.ts).

**When adding new features**: Follow this structure. Routes use `authenticate` middleware; admin/manager operations use `requireManager` or `requireAdmin`.

### 3. Currency and Precision
Use **Decimal.js** for all monetary calculations in TypeScript. Database stores currency as `NUMERIC(15, 4)`.

```typescript
import Decimal from 'decimal.js';
const total = new Decimal(price).times(quantity);
```

### 4. Authentication Flow
- JWT tokens stored in localStorage (`auth_token`, `auth_user`)
- Backend middleware at [src/middleware/auth.ts](../DigitalShop-Backend/src/middleware/auth.ts)
- Frontend context at [src/contexts/AuthContext.tsx](../DigitalShop-Frontend/src/contexts/AuthContext.tsx)
- Axios interceptor auto-attaches Bearer token ([src/lib/api.ts](../DigitalShop-Frontend/src/lib/api.ts))
- Roles: `ADMIN` > `MANAGER` > `CASHIER` > `STAFF`

## Development Workflows

### Database Setup
```powershell
# From DigitalShop-Shared/sql directory
$env:PGPASSWORD='02102010'
psql -U postgres -c "CREATE DATABASE digitalshop;"
psql -U postgres -d digitalshop -f "01_schema.sql"
psql -U postgres -d digitalshop -f "02_triggers.sql"
psql -U postgres -d digitalshop -f "03_seed.sql"  # Optional seed data
```

**After trigger changes**: Re-run `02_triggers.sql` (uses `CREATE OR REPLACE FUNCTION`).

### Running Development Servers
```powershell
# Backend (from DigitalShop-Backend/)
npm run dev  # Runs on localhost:8340 with tsx watch

# Frontend (from DigitalShop-Frontend/)
npm run dev  # Runs on localhost:5030 with Vite HMR
```

### Path Aliases
Backend uses TypeScript path aliases (configured in [tsconfig.json](../DigitalShop-Backend/tsconfig.json)):
- `@/*` → `src/*`
- `@modules/*` → `src/modules/*`
- `@utils/*` → `src/utils/*`

**Note**: Imports must use `.js` extension (ES module requirement) even though files are `.ts`.

### Logging
Winston logger at [src/utils/logger.ts](../DigitalShop-Backend/src/utils/logger.ts):
- Console + file logging (`logs/combined.log`, `logs/error.log`)
- Use `logger.info()`, `logger.error()` etc., not `console.log()`

## Key Integration Points

### Database Connection
Single shared pool at [src/db/pool.ts](../DigitalShop-Backend/src/db/pool.ts):
```typescript
import pool from './db/pool.js';
const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
```
**Always use parameterized queries** (`$1`, `$2`...) to prevent SQL injection.

### API Response Format
All endpoints return consistent structure:
```typescript
{ success: boolean, data?: T, error?: string, message?: string }
```

### Frontend API Client
Centralized axios instance at [src/lib/api.ts](../DigitalShop-Frontend/src/lib/api.ts). Use exported API functions:
```typescript
import { api, productsApi, salesApi } from '@/lib/api';
const response = await productsApi.getAll();
```

## Common Patterns

### Creating New Modules
1. **Database**: Add tables to [01_schema.sql](../DigitalShop-Shared/sql/01_schema.sql), triggers to [02_triggers.sql](../DigitalShop-Shared/sql/02_triggers.sql)
2. **Backend**: Create 4 files in `src/modules/{feature}/` (routes, controller, service, repository)
3. **Routes**: Mount in [server.ts](../DigitalShop-Backend/src/server.ts) (see lines 85-104)
4. **Frontend**: Add API client functions to [lib/api.ts](../DigitalShop-Frontend/src/lib/api.ts), create page in `src/pages/`, update routing

### Validation
Use Zod schemas in controllers:
```typescript
const schema = z.object({ name: z.string(), price: z.number() });
const validated = schema.parse(req.body);
```

### Stock/Inventory Changes
**Never modify inventory tables directly**. Use stored procedures or let triggers handle:
- Goods receipts create inventory batches
- Sales consume inventory via FIFO/AVCO
- Stock movements track all changes

## Documentation References
- [API.md](../API.md) - Complete API endpoint documentation
- [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) - Full schema with ERD
- [SETUP.md](../SETUP.md) - Installation guide
- [IMPLEMENTATION_PROGRESS.md](../IMPLEMENTATION_PROGRESS.md) - Current completion status
