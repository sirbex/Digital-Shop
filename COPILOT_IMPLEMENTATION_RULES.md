# Copilot Implementation Instructions — Inventory & ERP Core

**Purpose**: These are mandatory rules for Copilot when implementing or modifying any feature related to Inventory, Accounting, or POS within this ERP system.

**Last Updated**: January 29, 2026  
**Status**: Active Development — Enforce Strictly

---

## 🧠 GLOBAL ARCHITECTURE CONTRACT (HIGHEST PRIORITY)

Enterprise ERP — Schema, Validation, and UI Synchronization

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
  - **Compile after changes**: `cd DigitalShop-Shared; npx tsc`
- **Backend DTOs and Controllers**
  - Location: `DigitalShop-Backend/src/modules/**` (controller → service → repository)
  - Import pattern: `import * as Schemas from '../../../../DigitalShop-Shared/dist/zod/{entity}.js';`
  - Repositories use parameterized SQL only
- **Frontend UI**
  - Update models, forms, popups/modals, selectors, list/table columns wherever the entity appears
  - Import pattern: `import { SchemaName } from '@shared/zod/{entity}';`

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
- **After modifying schemas**: Run `cd DigitalShop-Shared; npx tsc` to compile

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
// Import from compiled dist folder
import * as ProductSchemas from '../../../../DigitalShop-Shared/dist/zod/product.js';
const { CreateProductSchema } = ProductSchemas;

// Controller: validate request with shared Zod schema
try {
  const validated = CreateProductSchema.parse(req.body);
  const data = validated as any; // Cast to service type
  const result = await productService.create(data);
  res.json({ success: true, data: result });
} catch (err: any) {
  if (err instanceof z.ZodError) {
    res.status(400).json({ success: false, error: err.issues[0].message });
  }
}
```

**Frontend usage (form example):**

```ts
// Import from @shared alias (configured in vite.config.ts)
import { CreateProductSchema } from '@shared/zod/product';
import type { CreateProduct } from '@shared/zod/product';

const handleSubmit = () => {
  try {
    const validated: CreateProduct = CreateProductSchema.parse(formData);
    await api.products.create(validated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      setError(err.issues[0].message);
    }
  }
};
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

### 5️⃣ Compilation Workflow

**When modifying shared schemas:**
```bash
# 1. Edit schema file
nano DigitalShop-Shared/zod/product.ts

# 2. Compile TypeScript to JavaScript
cd DigitalShop-Shared
npx tsc

# 3. Backend imports from compiled dist folder
# DigitalShop-Shared/dist/zod/{entity}.js

# 4. Frontend uses @shared alias (Vite resolves source .ts files)
```

**Import Patterns:**
- Backend: `import * as Schemas from '../../../../DigitalShop-Shared/dist/zod/{entity}.js';`
- Frontend: `import { Schema } from '@shared/zod/{entity}';`

---

## 🕐 0️⃣ TIMEZONE STRATEGY (CRITICAL - MUST FOLLOW)

### **MANDATORY: ONE TIMEZONE STRATEGY FOR ENTIRE SYSTEM**

**RULE: UTC Everywhere + Frontend Display Conversion Only**

This is **NON-NEGOTIABLE** and must be followed in ALL code:

#### Database Layer
```sql
-- ✅ CORRECT: Use DATE for transaction dates (no time, no timezone)
sale_date DATE                      -- 2025-11-15
expiry_date DATE                    -- 2025-12-31
order_date DATE                     -- 2025-11-01

-- ✅ CORRECT: Use TIMESTAMPTZ for audit timestamps (stored in UTC)
created_at TIMESTAMP WITH TIME ZONE -- 2025-11-16 13:20:56+00
updated_at TIMESTAMP WITH TIME ZONE -- 2025-11-16 13:20:56+00

-- ❌ FORBIDDEN: Never use TIMESTAMP WITHOUT TIME ZONE
created_at TIMESTAMP  -- WRONG! Ambiguous timezone
```

#### Backend Layer (Node.js + TypeScript)
```typescript
// ✅ CORRECT: Custom type parser configured in src/db/pool.ts
types.setTypeParser(1082, (val: string) => val); // DATE returns string

// ✅ CORRECT: Set UTC timezone for all connections
pool.on('connect', (client) => {
  client.query('SET timezone = "UTC"');
});

// ✅ CORRECT: Return dates as plain strings
const result = await pool.query('SELECT sale_date FROM sales WHERE id = $1', [id]);
// result.rows[0].sale_date = '2025-11-15' (string)

// ❌ FORBIDDEN: Never convert DATE to Date object
const saleDate = new Date(row.sale_date); // WRONG! Causes timezone shift

// ❌ FORBIDDEN: Never use toISOString() on dates
expiryDate: new Date(data.expiry).toISOString(); // WRONG! Adds timezone
```

#### API Response Format
```json
{
  "success": true,
  "data": {
    "saleDate": "2025-11-15",                    // ✅ Plain string YYYY-MM-DD
    "createdAt": "2025-11-16T13:20:56.222Z",    // ✅ ISO 8601 UTC timestamp
    "totalAmount": 96500
  }
}
```

#### Frontend Layer (React + TypeScript)
```typescript
// ✅ CORRECT: Send plain date strings to API
const saleData = {
  saleDate: '2025-11-15',  // From <input type="date">
  items: [...]
};
await api.post('/sales', saleData);

// ✅ CORRECT: Display dates in user timezone (for viewing only)
const displayDate = (dateString: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString; // DATE field - display as-is
  }
  return new Date(dateString).toLocaleString(); // TIMESTAMP - convert to local
};

// ❌ FORBIDDEN: Never send Date objects to API
saleDate: new Date() // WRONG! Send string instead
```

#### Date Filters
```typescript
// ✅ CORRECT: Send plain date strings for filtering
const filters = {
  startDate: '2025-11-01',  // Start of day
  endDate: '2025-11-15'     // End of day
};

// Backend interprets as full UTC days:
// 2025-11-01 00:00:00 UTC to 2025-11-01 23:59:59 UTC
```

### **ZERO TOLERANCE VIOLATIONS**
If you encounter or create code that violates this timezone strategy:
1. ❌ Converting DATE columns to Date objects in backend
2. ❌ Using `new Date().toISOString()` on date fields
3. ❌ Storing dates in TIMESTAMP WITHOUT TIME ZONE
4. ❌ Sending Date objects from frontend to API
5. ❌ Using timezone-aware operations on DATE fields

**→ STOP and fix immediately. This causes production bugs.**

**See**: `SamplePOS.Server/TIMEZONE_STRATEGY.md` for detailed implementation guide.

---

## ⚙️ 1️⃣ Core Development Principles

### Three-Layer Architecture (Mandatory)
```
Controller → Service → Repository → Database
```

**Controller**:
- Handles request/response validation and routing
- Uses Zod schemas for validation
- Maps requests to service calls
- Never contains business logic
- Never accesses database directly

**Service**:
- Contains ALL business logic
- Orchestrates repository calls
- Handles transaction management
- Performs calculations using Decimal.js
- Emits audit/event logs

**Repository**:
- Interacts directly with database using raw SQL only
- Accepts parameters, returns results
- No business logic whatsoever
- Uses parameterized queries exclusively

### Async/Await Only
- ✅ Always use `async/await` pattern
- ❌ Never use `.then()` chains
- Always handle errors with try/catch blocks

---

## 🧠 2️⃣ Validation & Data Contracts

### Zod Validation (Mandatory)
Use Zod for all validation (both input and output schemas).

Every API endpoint **must**:

1. **Validate `req.body` or `req.query` with a Zod schema**
   ```typescript
   const validatedData = MySchema.parse(req.body);
   ```

2. **Return a consistent response format**:
   ```typescript
   // Success
   {
     success: true,
     data: any,
     message?: string  // Optional
   }

   // Error
   {
     success: false,
     error: string
   }
   ```

3. **Never return raw DB rows directly**
   - Always map to schema-defined objects
   - Use Zod `.parse()` or `.safeParse()` for type safety

### Schema Location
- All shared schemas: `shared/zod/`
- Import and reuse across frontend and backend
- Never duplicate validation logic

---

## 💾 3️⃣ Database & Data Access

### Strict Rule: ❌ No ORM

**Never use**:
- Prisma
- TypeORM
- Sequelize
- Any other ORM

**Always use**:
- ✅ Raw SQL only, executed through `pg` (PostgreSQL) or `better-sqlite3` (SQLite)

### Repository Requirements

Repository files **must**:

1. **Use parameterized SQL queries** (`$1`, `$2`, …) to prevent injection
   ```typescript
   const result = await pool.query(
     'SELECT * FROM products WHERE id = $1',
     [productId]
   );
   ```

2. **Handle transactions atomically**
   ```typescript
   const client = await pool.connect();
   try {
     await client.query('BEGIN');
     // ... operations
     await client.query('COMMIT');
   } catch (error) {
     await client.query('ROLLBACK');
     throw error;
   } finally {
     client.release();
   }
   ```

3. **Never silently fail**
   - Always propagate or log errors
   - Use structured logging with context

4. **Define numeric fields correctly**
   - Use `DECIMAL` or `NUMERIC` in SQL for currency/quantities
   - Never use `FLOAT` or `DOUBLE` for financial data

---

## 🧮 4️⃣ Numeric Precision & Calculations

### Decimal.js for All Financial Math

Use `Decimal.js` for:
- Quantities
- Unit costs
- Margins
- Totals
- Tax calculations
- Discount calculations
- UoM conversions

**Never use native JS floats for financial math.**

### Example Usage
```typescript
import Decimal from 'decimal.js';

// ✅ Correct
const total = new Decimal(quantity).times(price);
const discountAmount = total.times(discountPercent).dividedBy(100);
const finalAmount = total.minus(discountAmount);

// ❌ Wrong
const total = quantity * price; // Precision loss!
```

### Decimal Configuration
```typescript
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
});
```

---

## 🧱 5️⃣ Frontend Rules (React + TypeScript)

### Component Architecture
- Use functional components with hooks
- No class components
- Follow React 19 best practices

### Input Validation
- All UI inputs must be controlled
- Validate with Zod schemas before submission
- Show validation errors inline

### API Integration
- Use React Query (TanStack Query) for all API calls
- No manual `fetch` unless absolutely necessary
- Centralize API endpoints in `src/api/` or `src/utils/api.ts`

### Styling
- Use TailwindCSS + ShadCN/UI components
- Follow existing design system
- No inline styles unless necessary

### Accessibility (a11y)
- Maintain ARIA labels on all interactive elements
- No unlabelled inputs or buttons
- Ensure keyboard navigation works
- Use semantic HTML

### Example Component Pattern
```typescript
import { z } from 'zod';
import { useForm } from '@tanstack/react-form';

const ProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});

export function ProductForm() {
  const form = useForm({
    defaultValues: { name: '', price: 0 },
    onSubmit: async (values) => {
      const validated = ProductSchema.parse(values);
      await api.products.create(validated);
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

---

## 🔒 6️⃣ Security & Permissions

### Authentication
- Every backend route must validate JWT tokens
- Use `authenticate` middleware
- Token in header: `Authorization: Bearer <token>`

### Authorization
- Check role-based access with `authorize` middleware
- Admin-only actions must verify `user.role === 'ADMIN'`
- Roles: ADMIN, MANAGER, CASHIER, STAFF

### Audit Logging
Log all critical operations:
- Stock adjustments
- Batch deletions/merges
- Price changes
- Cost changes
- User access changes

**Required audit fields**:
```typescript
{
  user_id: string,
  timestamp: Date,
  action: string,
  old_value: any,
  new_value: any,
  reference_type: string,
  reference_id: string
}
```

### Security Rules
- Never log passwords, tokens, or credit card numbers
- Validate and sanitize all user input
- Use environment variables for all secrets
- Implement rate limiting on public endpoints

---

## 🧩 7️⃣ Schema Consistency

### Product Schema (Mandatory Fields)

Product and Batch schemas must share consistent field names across:
- Inventory module
- POS module
- Reporting module
- Ledger module

**Mandatory Product Field Set**:
```typescript
{
  id: string;              // UUID
  productCode: string;     // SKU/Code
  name: string;            // Product name
  uom: string;             // Unit of measure
  costPrice: Decimal;      // Purchase cost
  sellingPrice: Decimal;   // Sale price
  quantity: Decimal;       // Stock quantity
  batchNumber?: string;    // Optional batch tracking
  expiryDate?: Date;       // Optional expiry tracking
  reorderLevel: Decimal;   // Reorder threshold
  isActive: boolean;       // Active status
  createdAt: Date;
  updatedAt: Date;
}
```

### Batch Schema (Mandatory Fields)
```typescript
{
  id: string;
  productId: string;
  batchNumber: string;
  quantity: Decimal;
  remainingQuantity: Decimal;
  expiryDate?: Date;
  receivedDate: Date;
  costPrice: Decimal;
  goodsReceiptId?: string;
  status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
  createdAt: Date;
  updatedAt: Date;
}
```

### Field Naming Convention
- Use camelCase in TypeScript/JavaScript
- Use snake_case in SQL
- Map between conventions in repository layer

---

## 🔁 8️⃣ Transaction & Audit Compliance

### Stock Movement Rules

Every stock movement, adjustment, or reorder **must**:

1. **Create a StockMovement record**
   ```typescript
   await stockMovementRepo.create({
     productId,
     batchId,
     movementType: 'ADJUSTMENT',
     quantity: adjustment,
     quantityBefore,
     quantityAfter,
     userId,
     referenceType: 'MANUAL_ADJUSTMENT',
     referenceId: adjustmentId,
     reason,
   });
   ```

2. **Create a LedgerEntry record** (for accounting integration)
   - Debit/credit inventory account
   - Link to originating transaction ID
   - Never mutate ledger data after posting

3. **Log audit trail**
   - `created_by`, `created_at`, `updated_at`
   - Change history in audit tables where applicable

### Transaction Atomicity
- All multi-step operations must be wrapped in database transactions
- On error: rollback everything
- On success: commit all changes together

---

## ⚡ 9️⃣ Performance & Caching

### In-Memory Caching
Use in-memory caching (NodeCache or Redis) for frequently accessed lookups:
- Product lists
- Batch summaries
- UOM conversions
- Price calculations

### Cache Invalidation
**Always invalidate cache on writes**:
- Insert/update/delete operations
- Clear specific keys or entire cache groups
- Use React Query's `invalidateQueries` on frontend

### Database Indexes
Ensure proper indexes exist:
```sql
-- FEFO batch selection
CREATE INDEX idx_batches_fefo 
  ON inventory_batches(product_id, expiry_date, remaining_quantity);

-- Stock level queries
CREATE INDEX idx_products_reorder 
  ON products(reorder_level, is_active);

-- Movement history
CREATE INDEX idx_movements_product 
  ON stock_movements(product_id, created_at DESC);
```

---

## 🧰 🔟 Coding Quality Standards

### Linting & Formatting
- ESLint + Prettier must pass with zero warnings
- Run `npm run lint:fix` before committing
- Follow existing `.eslintrc` and `.prettierrc` configurations

### TypeScript Strict Mode
- Follow strict TypeScript mode (`"strict": true` in `tsconfig.json`)
- No `any` types unless absolutely necessary
- Use proper type inference
- Define interfaces for all data structures

### Code Quality Rules
1. **Descriptive variable names**
   - ❌ No `data1`, `res2`, `temp`, `x`
   - ✅ Use `validatedProduct`, `stockLevel`, `adjustmentAmount`

2. **No code duplication**
   - Extract reusable utilities to `shared/utils/`
   - Create helper functions for common patterns

3. **Comment complex logic**
   - All complex SQL queries must have explanatory comments
   - Business rule implementations need BR-XXX references

4. **JSDoc headers**
   - All new files must include JSDoc-style headers:
   ```typescript
   /**
    * @module inventoryAdjustmentService
    * @description Handles all stock adjustment logic with ledger posting.
    * @requires Decimal.js for precision arithmetic
    */
   ```

---

## 🧭 11️⃣ Feature-Specific Rules

### Inventory Adjustments
- **Must post journal entries automatically**
- Requires reason code (minimum 5 characters)
- ADMIN or MANAGER role only
- Creates audit trail in `stock_movements`

### Batch Management
- All stock moves tied to `batch_id`
- FEFO ordering: earliest expiry first
- Never allow negative `remaining_quantity`
- Status must transition: ACTIVE → DEPLETED → EXPIRED

### Expiry Alerts
- Runs daily background job (scheduled task)
- Real-time dashboard widget
- Warning thresholds: 7 days (CRITICAL), 30 days (WARNING)
- Email notifications for CRITICAL expirations

### FEFO Selection (First Expiry First Out)
- POS must auto-select earliest expiry batch
- Algorithm in `inventoryService.selectBatchesForAllocation()`
- Visual display showing which batches will be consumed

### Cycle Counting
- Requires dual approval before posting correction
- Variance threshold: >5% triggers manager approval
- Auto-generates adjustment transactions
- Full audit trail of count vs system

### Auto-Reorder
- Must consider lead time + min/max levels
- Formula: `reorder_quantity = max_stock - current_stock`
- Trigger when: `current_stock <= reorder_level`
- Auto-creates PO in DRAFT status for review

---

## ✅ Copilot Golden Rules

### Do Not Auto-Guess Logic
- Follow schema & service patterns strictly
- Reference existing implementations
- Ask for clarification if requirements unclear

### Never Bypass Validation
- All inputs must pass Zod validation
- Never skip authentication/authorization checks
- Validate at controller layer, enforce at service layer

### Never Return Raw Database Results
- Always map to typed interfaces
- Use Zod schemas for output validation
- Transform snake_case to camelCase for frontend

### Always Handle Errors Gracefully
```typescript
try {
  const result = await service.operation(params);
  res.json({ success: true, data: result });
} catch (error) {
  logger.error('Operation failed', { error, params });
  res.status(500).json({ 
    success: false, 
    error: error.message || 'Operation failed' 
  });
}
```

### File Headers
All new files must include JSDoc-style headers:
```typescript
/**
 * @module inventoryAdjustmentService
 * @description Handles all stock adjustment logic with ledger posting.
 * @requires Decimal.js for precision arithmetic
 * @author Copilot
 * @created 2025-11-04
 */
```

---

## 🏁 Mission for Copilot

**Build a high-precision, fully auditable inventory and accounting core that's faster, cleaner, and more accurate than Odoo, Tally, and QuickBooks combined.**

### Core Tenets
1. **Precision First**: Bank-grade arithmetic using Decimal.js
2. **Audit Everything**: Full trail of who, what, when, why
3. **Validate Always**: Never trust input, always verify
4. **Layered Architecture**: Clear separation of concerns
5. **Type Safety**: Leverage TypeScript and Zod to the fullest
6. **Performance**: Cache aggressively, query efficiently
7. **Security**: Authentication, authorization, encryption
8. **Maintainability**: Clean code, no duplication, well-documented

---

## 📋 Pre-Commit Checklist

Before committing any code, verify:

- [ ] Followed Controller → Service → Repository layering
- [ ] Used Zod schemas from `shared/zod/`
- [ ] All SQL queries are parameterized
- [ ] No ORM code present
- [ ] Used `Decimal.js` for all financial calculations
- [ ] API responses follow `{ success, data?, error? }` format
- [ ] Error handling with try/catch
- [ ] No business logic in controllers
- [ ] No database access outside repositories
- [ ] JSDoc header on new files
- [ ] ESLint + Prettier passing
- [ ] TypeScript strict mode compliance
- [ ] Audit logging for critical operations
- [ ] Product field changes propagated globally (if applicable)

---

## 🔗 Related Documentation

- **Architecture Overview**: `ARCHITECTURE.md`
- **General Copilot Rules**: `COPILOT_INSTRUCTIONS.md`
- **GitHub-Scoped Instructions**: `.github/copilot-instructions.md`
- **Pricing & Costing System**: `SamplePOS.Server/PRICING_COSTING_SYSTEM.md`
- **Development Rules**: `DEVELOPMENT_RULES.md`

---

**Last Updated**: November 4, 2025  
**Maintainer**: Architecture Team  
**Status**: Mandatory — All implementations must comply
