# DigitalShop - Copilot Instructions for All Modules

**Date**: January 29, 2026  
**Architecture**: Modular Hybrid Monolith (No ORM)  
**Project Type**: ERP System with POS  
**Database**: `digitalshop` (PostgreSQL) - ALWAYS use this database consistently

> See also
- **Copilot Implementation Rules (MANDATORY)**: `./COPILOT_IMPLEMENTATION_RULES.md`
- **Global Architecture Contract**: See top section of `./COPILOT_IMPLEMENTATION_RULES.md`
- **GitHub-scoped agent guide**: `./.github/copilot-instructions.md`

## 🧠 STRICT RULES (MUST FOLLOW)

### Database Configuration (CRITICAL)
**ALWAYS use `digitalshop` database:**
- Production Database: `digitalshop` (PostgreSQL)
- Connection String: `postgresql://postgres:02102010@localhost:5432/digitalshop`
- Never switch to other databases
- All development, testing, and production must use `digitalshop` consistently
- All SQL queries, migrations, and tests must target `digitalshop`

### Project Structure
```
├── DigitalShop-Frontend/   → React + Vite + Tailwind CSS (frontend)
├── DigitalShop-Backend/    → Node.js + Express + Zod + pg (backend)
└── DigitalShop-Shared/     → Zod schemas and TypeScript types only
```

### Core Modules
- `DigitalShop-Backend/src/modules/pos/`
- `DigitalShop-Backend/src/modules/inventory/`
- `DigitalShop-Backend/src/modules/products/`
- `DigitalShop-Backend/src/modules/customers/`
- `DigitalShop-Backend/src/modules/suppliers/`
- `DigitalShop-Backend/src/modules/sales/`
- `DigitalShop-Backend/src/modules/purchases/`

### Absolute Requirements

✅ **Never duplicate** existing functions, validations, or API routes  
✅ **Never mix** backend and frontend logic — keep each in its folder  
✅ **Never introduce** Prisma, Sequelize, or any ORM  
✅ **Database access** must use parameterized SQL via `pg` or `better-sqlite3`  
✅ **All SQL** goes through a `Repository` layer only — not directly in controllers  
✅ **Always use** async/await and handle errors with try/catch and Zod  
✅ **Always validate** incoming data with Zod schemas from `DigitalShop-Shared/zod/`  
✅ **Use shared types** — do not redefine interfaces manually  
✅ **Each module** must include: controller → service → repository layers  
✅ **Frontend** must call backend using Axios only, no direct DB logic  
✅ **Never mix** React hooks with backend code  
✅ **All responses** follow this structure:
```typescript
{ 
  success: boolean; 
  message?: string; 
  data?: any; 
  error?: string 
}
```

### Timezone Strategy (MANDATORY)
**Single Strategy: UTC Everywhere + Frontend Display Conversion**

✅ **Database**: Store all timestamps in UTC (TIMESTAMPTZ), use DATE for transaction dates  
✅ **Backend**: Return dates as YYYY-MM-DD strings, timestamps as ISO 8601 UTC  
✅ **Frontend**: Convert to user timezone ONLY for display  
✅ **Never** convert DATE to Date object in backend (causes timezone shift)  
✅ **Custom type parser** configured in `DigitalShop-Backend/src/db/pool.ts` for DATE columns  
✅ **Date filters** send plain strings (YYYY-MM-DD) from frontend to backend  

**See**: `COPILOT_IMPLEMENTATION_RULES.md` Section 0️⃣ for full timezone strategy

### Layered Architecture (Mandatory)
```
Controller → Service → Repository → Database
```
- **Controller**: Request/response handling, validation
- **Service**: Business logic, orchestration
- **Repository**: SQL queries only (parameterized)
- Never skip layers or access database directly from controller

---

## Frontend Module – Copilot Instructions

1. Only generate React + TypeScript code using modern hooks and functional components.
2. Use Vite for build tooling and hot module replacement.
3. Use Tailwind CSS + shadcn/ui for all styling; no custom CSS unless absolutely necessary.
4. Validate all forms using Zod schemas imported from `@shared/zod/` (via path alias).
5. Use Axios for all API calls (centralized in `DigitalShop-Frontend/src/lib/api.ts`).
6. **Never access database directly** — always call backend via Axios.
7. **Never mix backend logic** in frontend components or hooks.
8. Handle loading, error, and empty states for all data fetching.
9. Implement optimistic UI updates for better perceived performance.
10. Add accessibility attributes (ARIA) to all interactive elements.
11. All API responses must follow: `{ success, message?, data?, error? }` structure.
12. Import Zod schemas from `@shared/zod/` — never redefine validation in frontend.
13. Use TypeScript types from `@shared/types/` via `z.infer<>` — never duplicate type definitions.

---

## Backend (Server) Module – Copilot Instructions

1. Only generate Node.js/TypeScript code with Express framework.
2. **Never use ORM** — use raw SQL with `pg` (PostgreSQL only).
3. **All SQL must be parameterized** to prevent SQL injection.
4. Follow strict layering: **Controller → Service → Repository → Database**.
5. **Never access database directly** from controllers or services.
6. Validate all incoming requests using Zod schemas from `DigitalShop-Shared/dist/zod/` (compiled).
7. Use **namespace imports** for Zod: `import * as Schemas from '../../../../DigitalShop-Shared/dist/zod/{entity}.js'`
8. Use Zod `.parse()` or `.safeParse()` — handle validation errors with `error.issues`.
9. **All responses must follow**: `{ success: boolean, message?: string, data?: any, error?: string }`.
10. Use async/await for all database operations with try/catch error handling.
11. **Never duplicate** existing routes, functions, or validations.
12. Organize by module: `DigitalShop-Backend/src/modules/{feature}/`.
13. Each module must have: `{feature}Controller.ts`, `{feature}Service.ts`, `{feature}Repository.ts`, `{feature}Routes.ts`.
14. Repository layer contains **only SQL queries** — no business logic.
15. Service layer contains **business logic** — orchestrates repositories.
16. Controller layer handles **HTTP requests/responses** — calls services.
17. Import types from `DigitalShop-Shared/types/` via `z.infer<>` — never redefine types in backend.
18. Use Winston logger at `DigitalShop-Backend/src/utils/logger.ts` — never log sensitive data (passwords, tokens).

---

## Repository Layer – Copilot Instructions

1. **Only SQL queries** — no business logic, no validation, no HTTP handling.
2. Always use parameterized queries to prevent SQL injection.
3. Use `pg` pool: `pool.query('SELECT * FROM users WHERE id = $1', [id])`.
4. Import pool from `DigitalShop-Backend/src/db/pool.ts`.
5. Export pure functions that accept parameters and return query results.
6. Handle database errors and throw descriptive error messages.
7. Use database transactions for multi-step operations.
8. **Never call other repositories** — keep queries isolated.
9. **Never import from controllers or services** — repository is lowest layer.
10. Return raw database results; let service layer transform data.
11. **Use field aliases** to return camelCase: `SELECT cost_price AS "costPrice"`.

Example structure:
```typescript
// DigitalShop-Backend/src/modules/customers/customersRepository.ts
import pool from '../../db/pool.js';

export async function findCustomerById(id: string) {
  const result = await pool.query(
    'SELECT id, name, email, phone, credit_limit AS "creditLimit" FROM customers WHERE id = $1',
    [id]
  );
  return result.rows[0];
}
```

---




    }
}
```

---

## Shared Folder – Copilot Instructions

1. Contains **only** Zod schemas and TypeScript types.
2. **Never include** business logic, database queries, or HTTP handlers.
3. Export Zod schemas for validation across frontend and backend.
4. Export TypeScript types using `z.infer<typeof Schema>`.
5. Keep schemas DRY — create reusable primitives (email, phone, currency).
6. Version schemas if breaking changes needed (v1, v2).
7. Use `.strict()` on object schemas to prevent unknown properties.
8. Include JSDoc comments explaining each field.
9. **MUST compile after changes**: `cd DigitalShop-Shared; npx tsc`.
10. Backend imports from `dist/zod/`, frontend imports from `zod/` (via @shared alias).

Example structure:
```typescript
// DigitalShop-Shared/zod/customer.ts
import { z } from 'zod';

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  creditLimit: z.number().nonnegative().default(0)
}).strict();

export const CreateCustomerSchema = CustomerSchema.omit({ id: true });
export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export type Customer = z.infer<typeof CustomerSchema>;
```

---

## 🧠 Copilot Development Rule: Product Schema Consistency

Whenever a new field is added or modified in the Product entity/model (for example: expiryDate, barcode, unitOfMeasure, reorderLevel, trackExpiry), you must ensure the following:

1) Surface the field consistently across the UI
- The new field appears and is usable across all Product-related views and components, including:
  - Product creation and edit modals/forms
  - Product list/grid/table views
  - Product details popup/side panel
  - Product selectors (search dropdowns, GR/PO screens, stock adjustments, etc.)

2) Centralize validation and computed logic
- Any validation or computed logic related to this field (e.g., expiry checks, stock warnings) must be:
  - Implemented once in a shared utility or Zod schema in `shared/zod`
  - Imported and reused everywhere the field appears (frontend and backend)
- Do not duplicate page-specific validation. Prefer a shared hook like `useProductValidation()` or shared helpers that wrap Zod schemas.

3) Auto-update missing components
- If any Product popup, modal, or component does not yet include this field, update it to include it (with correct labels, help text, and accessibility attributes).

4) Avoid page-specific expiry logic
- Never create separate expiry-check logic for a single page (e.g., GR only). Move expiry validation into shared schemas/utilities so all UIs share identical rules.

5) Keep types and DTOs in sync
- Ensure type definitions (`Product`, `ProductDTO`, etc.) are updated in `shared/types`, and all API DTOs are synchronized with backend schemas and database fields.

6) Verify end-to-end wiring
- After adding a field, ensure:
  - Frontend Zod schema includes it
  - Backend validation and DB migration support it (add a SQL migration in `shared/sql` when needed)
  - The UI binds it correctly in all relevant forms, tables, and selectors

Reminder: Product fields must propagate globally across all product views automatically. Never hardcode field subsets.

---

## Module Organization (Mandatory Structure)

Each module must follow this structure:

```
DigitalShop-Backend/src/modules/customers/
├── customersController.ts    → HTTP request/response handling
├── customersService.ts        → Business logic
├── customersRepository.ts     → SQL queries only
└── customersRoutes.ts         → Express route definitions
```

**Modules Implemented**:
- `auth/` - Authentication and user management
- `pos/` - Point of sale operations
- `products/` - Product catalog management
- `inventory/` - Stock management, batches, movements
- `customers/` - Customer management and credit tracking
- `suppliers/` - Supplier management
- `sales/` - Sales transactions and history
- `purchases/` - Purchase orders and goods receipts
- `reports/` - Business intelligence and reporting
- `cash-register/` - Cash register session management

---

## General Cross-Module Guidelines

### Module Boundaries
- Modules communicate through well-defined public interfaces
- Use internal event bus for asynchronous communication between modules
- Never directly access another module's database or internal state
- Each module should be independently testable and deployable

### Error Handling
- Always return structured error responses with error codes
- Include request IDs for tracing across services
- Log errors with full context but sanitize sensitive data

### Security
- Never log passwords, tokens, or credit card numbers
- Validate and sanitize all user input
- Use environment variables for all secrets and API keys
- Implement rate limiting on public endpoints

### Testing
- Write unit tests for all business logic
- Write integration tests for API endpoints
- Use test fixtures and factories for test data
- Mock external dependencies in tests

### Documentation
- Every service must have a README.md with setup instructions
- Document all environment variables required
- Include example requests/responses for APIs
- Keep architecture diagrams up to date

### Performance
- Cache expensive operations where appropriate
- Use database indexes for frequently queried fields
- Implement pagination for list endpoints
- Use connection pooling for database connections

### Monitoring
- Expose `/health` and `/ready` endpoints for each module
- Log structured JSON for easy parsing
- Track key metrics (latency, error rate, throughput) per module
- Use correlation IDs to trace requests across module boundaries
- Monitor internal event bus for message backlog and latency

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + Vite + TypeScript | UI/UX |
| UI Components | shadcn/ui + Tailwind CSS | Component library + styling |
| HTTP Client | Axios | API calls |
| Backend | Node.js + Express + TypeScript | REST API server |
| Validation | Zod (shared package) | Runtime type validation |
| Database | PostgreSQL 14+ (pg driver) | Data persistence |
| SQL | Raw parameterized queries | No ORM - direct SQL |
| Logging | Winston | Structured logging |
| Authentication | JWT + bcrypt | Token-based auth |
| Dev Server | tsx (backend) + Vite (frontend) | Hot reload development |

**Architecture**: Modular Hybrid Monolith (No ORM)  
**Ports**: Backend 8340, Frontend 5030  
**Database**: `digitalshop` (PostgreSQL)  
**All Modules**: POS, Products, Inventory, Customers, Suppliers, Sales, Purchases, Auth

---

## API Response Format (Mandatory)

All backend endpoints must return this structure:

```typescript
// Success response
{
  "success": true,
  "data": { /* actual data */ },
  "message": "Operation successful" // optional
}

// Error response
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Never deviate from this format** — frontend expects consistent structure.

---

## Database Rules (Critical)

### ❌ NEVER DO THIS:
```typescript
// Don't use ORM
const user = await User.findOne({ where: { id: 1 } }); // ❌

// Don't query in controller
app.get('/users', async (req, res) => {
  const users = await pool.query('SELECT * FROM users'); // ❌
  res.json(users);
});

// Don't use string interpolation
const query = `SELECT * FROM users WHERE id = ${id}`; // ❌ SQL injection!

// Don't use named imports for Zod schemas in backend
import { CreateUserSchema } from '../../../../DigitalShop-Shared/dist/zod/user.js'; // ❌
```

### ✅ ALWAYS DO THIS:
```typescript
// Use parameterized queries in repository
import pool from '../../db/pool.js';

export async function findUserById(id: string) {
  const result = await pool.query(
    'SELECT id, email, role, full_name AS "fullName" FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

// Call repository from service
export async function getUser(id: string) {
  const user = await findUserById(id);
  if (!user) throw new Error('User not found');
  return user;
}

// Call service from controller with namespace import
import * as UserSchemas from '../../../../DigitalShop-Shared/dist/zod/user.js';
const { LoginSchema } = UserSchemas;

export async function getUserHandler(req: Request, res: Response) {
  try {
    const user = await getUser(req.params.id);
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
}
```

---

## Database-First Design

**Critical**: All business logic lives in PostgreSQL triggers (see `DigitalShop-Shared/sql/02_triggers.sql`).

**Key Triggers**:
1. **Tax Calculation**: Automatic tax computation on sales
2. **Customer Balance**: Auto-update from credit sales and payments
3. **Stock Movement Tracking**: FIFO/AVCO costing via triggers
4. **Automatic Numbering**: Sale numbers, movement numbers
5. **Inventory Updates**: Batch consumption on sales, receipt creation on goods receipts

**When modifying sales/inventory/pricing logic**: Update triggers, not application code.

---

## Modular Monolith Benefits

✅ **Simplified Deployment**: Single application, easier to deploy and manage  
✅ **Reduced Latency**: In-process communication is faster than network calls  
✅ **Easier Development**: Run entire application locally without complex infrastructure  
✅ **Strong Consistency**: ACID transactions across modules when needed  
✅ **Lower Operational Cost**: One database, one server, simpler monitoring  
✅ **Future Flexibility**: Modules can be extracted to microservices if needed

---

## Module Independence Rules

1. **No Direct Dependencies**: Modules cannot directly reference each other's internals
2. **Public Contracts**: Use shared Zod schemas from `DigitalShop-Shared/zod/`
3. **Service Orchestration**: Services can call other services when needed (e.g., sales → inventory)
4. **Database Schema**: Single `digitalshop` database with 20+ tables across modules
5. **Module Boundaries**: Each module owns specific tables (e.g., products owns `products`, customers owns `customers`)
6. **Shared Tables**: Some tables used by multiple modules (e.g., `inventory_batches`, `stock_movements`)

---

## Common Pitfalls to Avoid

1. ❌ Mixing frontend and backend logic
2. ❌ Accessing database from controller or service directly
3. ❌ Using ORM (Prisma, Sequelize, TypeORM, etc.)
4. ❌ String interpolation in SQL queries
5. ❌ Duplicating validation logic (use shared Zod schemas)
6. ❌ Redefining types (use shared types)
7. ❌ Skipping error handling (always use try/catch)
8. ❌ Inconsistent API response format
9. ❌ Business logic in controllers
10. ❌ HTTP handling in services

---

## Checklist Before Committing Code

- [ ] Followed Controller → Service → Repository layering
- [ ] Used Zod schemas from `DigitalShop-Shared/zod/` (compiled to `dist/` for backend)
- [ ] Used types via `z.infer<>` — never manually defined
- [ ] Compiled shared package after schema changes: `cd DigitalShop-Shared; npx tsc`
- [ ] Backend uses namespace imports: `import * as Schemas from '...dist/zod/{entity}.js'`
- [ ] Frontend uses path alias: `import { Schema } from '@shared/zod/{entity}'`
- [ ] All SQL queries are parameterized ($1, $2, etc.)
- [ ] Used field aliases for camelCase: `cost_price AS "costPrice"`
- [ ] No ORM code present (Prisma/Sequelize/TypeORM)
- [ ] API responses follow `{ success, data?, error? }` format
- [ ] Error handling with try/catch, Zod errors use `error.issues`
- [ ] No duplicate functions or routes
- [ ] No business logic in controllers or repositories
- [ ] No database access outside repositories
- [ ] No frontend logic in backend
- [ ] No backend logic in frontend
- [ ] Used Decimal.js for all currency/quantity calculations
- [ ] Date fields handled as strings (YYYY-MM-DD), never converted to Date objects
- [ ] Product/Customer/Entity field changes propagated across all layers (DB → Zod → Backend → Frontend UI)
- [ ] Used Winston logger, not console.log

---

*These rules are mandatory. Code that violates these rules should not be committed.*
