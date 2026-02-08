# DigitalShop Backend

Enterprise-grade backend for Point of Sale, Inventory Management, and Reporting System.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Create database:
```bash
psql -U postgres -c "CREATE DATABASE digitalshop;"
```

4. Run database schema:
```bash
psql -U postgres -d digitalshop -f ../DigitalShop-Shared/sql/01_schema.sql
psql -U postgres -d digitalshop -f ../DigitalShop-Shared/sql/02_triggers.sql
```

5. Start development server:
```bash
npm run dev
```

Server will be available at `http://localhost:8340`

## 📁 Project Structure

```
src/
├── modules/           # Feature modules
│   ├── auth/         # Authentication
│   ├── users/        # User management
│   ├── customers/    # Customer management
│   ├── suppliers/    # Supplier management
│   ├── products/     # Product catalog
│   ├── inventory/    # Inventory & batches
│   ├── purchases/    # Purchase orders & goods receipts
│   ├── pos/          # Point of sale (sales)
│   ├── cash-register/# Cash register sessions
│   └── reports/      # Reporting engine
├── db/               # Database connection
├── middleware/       # Express middleware
├── utils/            # Utility functions
├── services/         # Shared business logic
└── server.ts         # Application entry point
```

## 🔧 Configuration

Environment variables (see `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8340 |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | JWT signing secret | - |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:5030 |
| `DEFAULT_TAX_RATE` | Default tax rate (decimal) | 0.06 |

## 🏗️ Architecture

### Layered Architecture
- **Controllers**: HTTP request/response handling, validation
- **Services**: Business logic orchestration
- **Repositories**: Data access layer with raw SQL

### Key Principles
- **No ORM**: Raw SQL through pg library for transparency
- **Database-driven calculations**: All totals/balances calculated by database triggers
- **Type safety**: Full TypeScript with strict mode
- **Validation**: Zod schemas for all inputs
- **Decimal precision**: Decimal.js for monetary calculations

## 📡 API Response Format

All API responses follow this standard format:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## 🔐 Authentication

JWT-based authentication with role-based access control (RBAC).

**Roles:**
- `ADMIN`: Full system access
- `MANAGER`: Managerial operations
- `CASHIER`: POS operations
- `STAFF`: Limited access

**Headers:**
```
Authorization: Bearer <jwt_token>
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📦 Scripts

```bash
npm run dev       # Start development server with hot reload
npm run build     # Build for production
npm start         # Run production server
npm test          # Run tests
npm run lint      # Lint code
npm run format    # Format code with Prettier
```

## 🔍 Logging

Winston-based logging with multiple transports:
- Console output (development)
- File logs (`logs/combined.log`)
- Error logs (`logs/error.log`)

## 🚨 Error Handling

Centralized error handling with appropriate HTTP status codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

## 🔗 Related Repositories

- **Frontend**: `../DigitalShop-Frontend`
- **Shared**: `../DigitalShop-Shared` (types, schemas, SQL)

## 📝 License

MIT
