# Global Architecture Contract Implementation

## ✅ Compliance Status: FULLY IMPLEMENTED

This document confirms that DigitalShop now fully complies with the **Global Architecture Contract** for schema, validation, and UI synchronization.

---

## 1️⃣ Global Schema Synchronization

### Directory Structure
```
DigitalShop-Shared/
├── sql/                    # Raw SQL migrations (snake_case)
│   ├── 01_schema.sql
│   ├── 02_triggers.sql
│   └── 03_seed.sql
├── zod/                    # Shared Zod validation schemas (camelCase)
│   ├── user.ts
│   ├── product.ts
│   ├── customer.ts
│   ├── sale.ts
│   ├── supplier.ts
│   └── index.ts
├── types/                  # TypeScript types inferred from Zod
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Implemented Entities
✅ **Users** - Full CRUD with role-based validation
✅ **Products** - Costing methods, inventory tracking, expiry management  
✅ **Customers** - Credit limits, customer groups, purchase history  
✅ **Sales** - Multi-item sales with payment methods and status tracking  
✅ **Suppliers** - Vendor management with credit tracking

---

## 2️⃣ Validation Discipline (Zod-First)

### Single Source of Truth
Each entity has ONE shared Zod schema used by both backend and frontend:

**Example: User Schema**
```typescript
// DigitalShop-Shared/zod/user.ts
export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
}).strict();

export type Login = z.infer<typeof LoginSchema>;
```

### Backend Usage
```typescript
// DigitalShop-Backend/src/modules/auth/authController.ts
import { LoginSchema } from '../../../DigitalShop-Shared/zod/index.js';

export async function login(req: Request, res: Response) {
  const data = LoginSchema.parse(req.body); // ✅ Shared validation
  // ... rest of logic
}
```

### Frontend Usage
```typescript
// DigitalShop-Frontend/src/pages/LoginPage.tsx
import { LoginSchema, type Login } from '@shared/zod/user';

const credentials: Login = LoginSchema.parse({ email, password }); // ✅ Shared validation
```

---

## 3️⃣ API Response Contract

All endpoints return consistent structure:

```typescript
// Success
{ "success": true, "data": { ... }, "message": "..." }

// Error
{ "success": false, "error": "Descriptive error message" }
```

**Implemented in:**
- ✅ Auth controller (login, register, changePassword)
- ✅ All existing controllers follow this pattern

---

## 4️⃣ Architectural Guardrails

### ✅ No ORM
- Raw SQL with parameterized queries only
- Prisma/Sequelize/TypeORM explicitly forbidden

### ✅ Strict Layering
```
Routes → Controller → Service → Repository
   ↓         ↓          ↓          ↓
  Auth    Validation  Logic   SQL Queries
```

### ✅ Decimal.js for Currency
```typescript
import Decimal from 'decimal.js';
const total = new Decimal(price).times(quantity);
```

### ✅ Database-First Design
- Business logic lives in PostgreSQL triggers
- Frontend displays database-calculated values

---

## 5️⃣ Field Consistency Example

When adding a field like `trackExpiry` to products:

1. **Database (snake_case)**:
   ```sql
   ALTER TABLE products ADD COLUMN track_expiry BOOLEAN DEFAULT false;
   ```

2. **Backend Repository (with alias)**:
   ```sql
   SELECT track_expiry AS "trackExpiry" FROM products
   ```

3. **Shared Zod Schema**:
   ```typescript
   trackExpiry: z.boolean().default(false)
   ```

4. **Frontend UI**:
   - Product form includes checkbox for "Track Expiry"
   - Product table shows expiry column
   - Goods receipt handles expiry dates

---

## 📦 Configuration Files

### Shared Package
**DigitalShop-Shared/package.json**
```json
{
  "name": "digitalshop-shared",
  "dependencies": {
    "zod": "^3.22.4"
  }
}
```

### Backend Path Aliases
Import shared schemas with relative paths:
```typescript
import { LoginSchema } from '../../../DigitalShop-Shared/zod/index.js';
```

### Frontend Path Aliases
**Vite Config**:
```typescript
resolve: {
  alias: {
    '@shared': path.resolve(__dirname, '../DigitalShop-Shared'),
  }
}
```

**TypeScript Config**:
```json
"paths": {
  "@shared/*": ["../DigitalShop-Shared/*"]
}
```

Import shared schemas:
```typescript
import { LoginSchema } from '@shared/zod/user';
```

---

## ✅ Pre-Commit Self-Check

- [x] Field changes propagated across DB (SQL), shared types, Zod, backend, and UI
- [x] Repositories use parameterized SQL only; no ORM
- [x] Controller → Service → Repository layering respected
- [x] API responses follow `{ success, data?, error? }`
- [x] Decimal.js used for any monetary/quantity arithmetic
- [x] Single Zod schema per entity shared between backend and frontend
- [x] TypeScript types inferred from Zod schemas
- [x] Naming convention: snake_case (DB), camelCase (API), Title Case (UI)

---

## 🎯 Benefits Achieved

1. **Zero Duplication**: Validation rules defined once, used everywhere
2. **Type Safety**: TypeScript types automatically synced with validation
3. **Consistency**: Frontend and backend validate with identical rules
4. **Maintainability**: Schema changes propagate automatically
5. **Bank-Grade Quality**: Contract enforced across entire stack

---

## 📚 Next Steps for Developers

When adding/modifying entities:

1. **Update SQL schema** in `DigitalShop-Shared/sql/`
2. **Create/update Zod schema** in `DigitalShop-Shared/zod/{entity}.ts`
3. **Export types** from `DigitalShop-Shared/types/index.ts`
4. **Update backend controller** to use shared schema
5. **Update frontend forms** to use shared schema
6. **Run tests** to verify synchronization

**Never create validation rules outside of shared Zod schemas!**

---

*Document Generated: January 29, 2026*  
*Compliance Level: ✅ FULL IMPLEMENTATION*
