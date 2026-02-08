# DigitalShop - API Documentation

Complete API reference for DigitalShop backend (port 8340).

---

## 📡 Base URL

```
Development: http://localhost:8340/api
Production: https://your-domain.com/api
```

---

## 🔐 Authentication

All protected endpoints require JWT token in Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### Login

**POST** `/api/auth/login`

```json
Request:
{
  "email": "admin@digitalshop.com",
  "password": "admin123"
}

Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "admin@digitalshop.com",
      "fullName": "Admin User",
      "role": "ADMIN",
      "isActive": true
    }
  }
}
```

### Register

**POST** `/api/auth/register`

```json
Request:
{
  "email": "user@example.com",
  "password": "securepassword",
  "fullName": "John Doe",
  "role": "CASHIER"
}

Response:
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@example.com"
  }
}
```

**Roles**: `ADMIN`, `MANAGER`, `CASHIER`, `STAFF`

---

## 👥 Users

### Get All Users

**GET** `/api/users`

**Authorization**: Admin or Manager

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "cashier@shop.com",
      "fullName": "Jane Smith",
      "role": "CASHIER",
      "isActive": true,
      "createdAt": "2026-01-29T10:00:00Z"
    }
  ]
}
```

### Get User by ID

**GET** `/api/users/:id`

**Authorization**: Admin, Manager, or Self

```json
Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@shop.com",
    "fullName": "John Doe",
    "role": "STAFF",
    "isActive": true,
    "createdAt": "2026-01-29T10:00:00Z",
    "updatedAt": "2026-01-29T10:00:00Z"
  }
}
```

### Update User

**PUT** `/api/users/:id`

**Authorization**: Admin or Self (limited fields)

```json
Request:
{
  "fullName": "Jane Doe",
  "role": "MANAGER",  // Admin only
  "isActive": false   // Admin only
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "fullName": "Jane Doe",
    "role": "MANAGER"
  }
}
```

### Delete User

**DELETE** `/api/users/:id`

**Authorization**: Admin only

---

## 🛍️ Products

### Get All Products

**GET** `/api/products`

**Query Parameters**:
- `category` - Filter by category
- `trackExpiry` - Filter by expiry tracking (true/false)
- `search` - Search by name, SKU, or barcode

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sku": "PROD-001",
      "barcode": "1234567890123",
      "name": "Product Name",
      "category": "Electronics",
      "costPrice": "100.00",
      "sellingPrice": "150.00",
      "quantityOnHand": 50,
      "costingMethod": "FIFO",
      "trackExpiry": false,
      "isTaxable": true,
      "taxRate": "0.06",
      "isActive": true
    }
  ]
}
```

### Get Product by ID

**GET** `/api/products/:id`

```json
Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "sku": "PROD-001",
    "name": "Product Name",
    "costPrice": "100.00",
    "sellingPrice": "150.00",
    "quantityOnHand": 50,
    "batches": [
      {
        "batchNumber": "BATCH-001",
        "remainingQuantity": 30,
        "expiryDate": "2027-12-31",
        "costPrice": "95.00"
      }
    ]
  }
}
```

### Create Product

**POST** `/api/products`

**Authorization**: Manager or Admin

```json
Request:
{
  "sku": "PROD-002",
  "barcode": "9876543210987",
  "name": "New Product",
  "category": "Food",
  "costPrice": 50.00,
  "sellingPrice": 75.00,
  "costingMethod": "FIFO",
  "trackExpiry": true,
  "isTaxable": true,
  "taxRate": 0.06
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "sku": "PROD-002",
    "name": "New Product"
  }
}
```

### Update Product

**PUT** `/api/products/:id`

**Authorization**: Manager or Admin

```json
Request:
{
  "sellingPrice": 80.00,
  "isActive": true
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "sellingPrice": "80.00"
  }
}
```

---

## 📦 Inventory

### Get Inventory Batches

**GET** `/api/inventory/batches`

**Query Parameters**:
- `productId` - Filter by product
- `status` - Filter by status (ACTIVE, DEPLETED, EXPIRED)
- `expiringBefore` - ISO date (e.g., 2026-12-31)

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "batchNumber": "BATCH-001",
      "productId": "uuid",
      "productName": "Product Name",
      "quantity": 100,
      "remainingQuantity": 85,
      "costPrice": "95.00",
      "expiryDate": "2027-06-30",
      "status": "ACTIVE",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ]
}
```

### Get Stock Movements

**GET** `/api/inventory/movements`

**Query Parameters**:
- `productId` - Filter by product
- `type` - SALE, PURCHASE, ADJUSTMENT, RETURN, TRANSFER
- `startDate` - ISO date
- `endDate` - ISO date

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "movementNumber": "SM-2026-000123",
      "productId": "uuid",
      "productName": "Product Name",
      "quantity": -5,
      "movementType": "SALE",
      "referenceType": "sale",
      "referenceId": "uuid",
      "batchId": "uuid",
      "createdAt": "2026-01-29T14:30:00Z"
    }
  ]
}
```

### Create Stock Adjustment

**POST** `/api/inventory/adjustments`

**Authorization**: Manager or Admin

```json
Request:
{
  "productId": "uuid",
  "batchId": "uuid",
  "quantity": 10,  // Positive = add, Negative = remove
  "reason": "Damaged goods",
  "notes": "Found 10 damaged items during inspection"
}

Response:
{
  "success": true,
  "data": {
    "movementId": "uuid",
    "movementNumber": "SM-2026-000124",
    "newQuantity": 95
  }
}
```

---

## 🛒 Purchase Orders

### Get All Purchase Orders

**GET** `/api/purchases/orders`

**Query Parameters**:
- `status` - DRAFT, PENDING, COMPLETED, CANCELLED
- `supplierId` - Filter by supplier

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "orderNumber": "PO-2026-0001",
      "supplierId": "uuid",
      "supplierName": "Supplier ABC",
      "status": "PENDING",
      "totalAmount": "5000.00",
      "orderDate": "2026-01-25",
      "createdAt": "2026-01-25T09:00:00Z",
      "items": [
        {
          "productId": "uuid",
          "productName": "Product X",
          "orderedQuantity": 100,
          "receivedQuantity": 0,
          "unitPrice": "50.00"
        }
      ]
    }
  ]
}
```

### Create Purchase Order

**POST** `/api/purchases/orders`

**Authorization**: Manager or Admin

```json
Request:
{
  "supplierId": "uuid",
  "orderDate": "2026-01-29",
  "items": [
    {
      "productId": "uuid",
      "quantity": 100,
      "unitPrice": 50.00
    }
  ],
  "notes": "Urgent order"
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderNumber": "PO-2026-0002",
    "totalAmount": "5000.00"
  }
}
```

### Update PO Status

**PATCH** `/api/purchases/orders/:id/status`

**Authorization**: Manager or Admin

```json
Request:
{
  "status": "PENDING"  // DRAFT → PENDING → COMPLETED
}

Response:
{
  "success": true,
  "data": {
    "orderNumber": "PO-2026-0001",
    "status": "PENDING"
  }
}
```

---

## 📥 Goods Receipts

### Create Goods Receipt

**POST** `/api/purchases/receipts`

**Authorization**: Manager or Admin

```json
Request:
{
  "purchaseOrderId": "uuid",
  "receiptDate": "2026-01-29",
  "items": [
    {
      "productId": "uuid",
      "receivedQuantity": 95,  // Out of 100 ordered
      "batchNumber": "BATCH-NEW-001",
      "expiryDate": "2027-12-31",  // If trackExpiry=true
      "costPrice": 48.00  // Can differ from PO price
    }
  ],
  "notes": "5 items damaged in transit"
}

Response:
{
  "success": true,
  "data": {
    "receiptNumber": "GR-2026-0001",
    "totalValue": "4560.00",
    "batchesCreated": ["BATCH-NEW-001"]
  }
}
```

### Get All Goods Receipts

**GET** `/api/purchases/receipts`

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "receiptNumber": "GR-2026-0001",
      "purchaseOrderId": "uuid",
      "orderNumber": "PO-2026-0001",
      "status": "COMPLETED",
      "totalValue": "4560.00",
      "receiptDate": "2026-01-29",
      "items": [...]
    }
  ]
}
```

---

## 💰 Sales / POS

### Create Sale

**POST** `/api/sales`

**Authorization**: Cashier or above

```json
Request:
{
  "customerId": "uuid",  // Optional
  "paymentMethod": "CASH",  // CASH, CARD, MOBILE_MONEY, CREDIT
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": 150.00,  // Can override for discounts
      "batchId": "uuid"  // Optional, auto-selected if not provided (FEFO)
    }
  ],
  "subtotal": 300.00,
  "taxAmount": 18.00,  // 6% of subtotal
  "totalAmount": 318.00,
  "amountPaid": 500.00,  // For CASH payment
  "changeAmount": 182.00,
  "cashRegisterSessionId": "uuid",
  "notes": "Customer requested gift wrap"
}

Response:
{
  "success": true,
  "data": {
    "saleId": "uuid",
    "saleNumber": "SALE-2026-00123",
    "totalAmount": "318.00",
    "profit": "118.00",  // Calculated automatically
    "profitMargin": "37.11",
    "receiptUrl": "/receipts/SALE-2026-00123.pdf"
  }
}
```

### Get All Sales

**GET** `/api/sales`

**Query Parameters**:
- `startDate` - ISO date
- `endDate` - ISO date
- `customerId` - Filter by customer
- `paymentMethod` - Filter by payment method
- `sessionId` - Filter by cash register session

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "saleNumber": "SALE-2026-00123",
      "customerId": "uuid",
      "customerName": "John Doe",
      "subtotal": "300.00",
      "taxAmount": "18.00",
      "totalAmount": "318.00",
      "totalCost": "200.00",
      "profit": "118.00",
      "profitMargin": "37.11",
      "paymentMethod": "CASH",
      "saleDate": "2026-01-29",
      "createdAt": "2026-01-29T15:30:00Z",
      "items": [...]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

### Get Sale by ID

**GET** `/api/sales/:id`

```json
Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "saleNumber": "SALE-2026-00123",
    "customerName": "John Doe",
    "totalAmount": "318.00",
    "items": [
      {
        "productName": "Product X",
        "quantity": 2,
        "unitPrice": "150.00",
        "unitCost": "100.00",
        "totalPrice": "300.00",
        "batchNumber": "BATCH-001"
      }
    ]
  }
}
```

---

## 🏦 Cash Register

### Open Session

**POST** `/api/cash-register/sessions/open`

**Authorization**: Cashier or above

```json
Request:
{
  "registerId": "uuid",
  "openingFloat": 1000.00,
  "denominationBreakdown": {
    "50000": 10,  // 10 × UGX 50,000
    "20000": 20,  // 20 × UGX 20,000
    "10000": 30   // 30 × UGX 10,000
  }
}

Response:
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "sessionNumber": "CS-2026-00045",
    "openingFloat": "1000.00",
    "openedAt": "2026-01-29T08:00:00Z"
  }
}
```

### Close Session

**POST** `/api/cash-register/sessions/:id/close`

**Authorization**: Manager or Admin

```json
Request:
{
  "actualClosing": 5230.00,
  "denominationBreakdown": {
    "50000": 50,
    "20000": 60,
    "10000": 70,
    "5000": 30,
    "2000": 40,
    "1000": 50
  }
}

Response:
{
  "success": true,
  "data": {
    "sessionNumber": "CS-2026-00045",
    "expectedClosing": "5250.00",
    "actualClosing": "5230.00",
    "variance": "-20.00",  // Shortage
    "totalSales": "4250.00",
    "cashSales": "3800.00",
    "cardSales": "450.00",
    "closedAt": "2026-01-29T20:00:00Z"
  }
}
```

### Record Cash Movement

**POST** `/api/cash-register/movements`

**Authorization**: Manager or above

```json
Request:
{
  "sessionId": "uuid",
  "movementType": "PAYOUT",  // FLOAT_IN, FLOAT_OUT, PAYOUT, BANK_DEPOSIT
  "amount": 500.00,
  "description": "Supplier payment - cash",
  "referenceType": "supplier_payment",  // Optional
  "referenceId": "uuid"  // Optional
}

Response:
{
  "success": true,
  "data": {
    "movementId": "uuid",
    "newBalance": "4750.00"
  }
}
```

---

## 👥 Customers

### Get All Customers

**GET** `/api/customers`

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "0700123456",
      "balance": "-500.00",  // Negative = owes money
      "creditLimit": "1000.00",
      "customerGroupId": "uuid",
      "groupName": "Retail",
      "isActive": true
    }
  ]
}
```

### Create Customer

**POST** `/api/customers`

```json
Request:
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "0700654321",
  "customerGroupId": "uuid",
  "creditLimit": 2000.00,
  "address": "123 Main St",
  "notes": "VIP customer"
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Jane Smith",
    "balance": "0.00"
  }
}
```

### Get Customer Transactions

**GET** `/api/customers/:id/transactions`

```json
Response:
{
  "success": true,
  "data": {
    "customer": {
      "name": "John Doe",
      "balance": "-500.00"
    },
    "transactions": [
      {
        "date": "2026-01-29",
        "type": "SALE",
        "referenceNumber": "SALE-2026-00120",
        "amount": "500.00",
        "balance": "-500.00"
      }
    ]
  }
}
```

---

## 🏢 Suppliers

### Get All Suppliers

**GET** `/api/suppliers`

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Supplier ABC",
      "contactPerson": "Mr. Smith",
      "email": "supplier@abc.com",
      "phone": "0700111222",
      "balance": "5000.00",  // Positive = we owe them
      "isActive": true
    }
  ]
}
```

### Create Supplier

**POST** `/api/suppliers`

**Authorization**: Manager or Admin

```json
Request:
{
  "name": "New Supplier Ltd",
  "contactPerson": "Jane Manager",
  "email": "contact@newsupplier.com",
  "phone": "0700333444",
  "address": "456 Industrial Ave",
  "paymentTerms": "Net 30",
  "notes": "Reliable supplier"
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "New Supplier Ltd"
  }
}
```

---

## 📊 Reports

### Sales Summary Report

**GET** `/api/reports/sales-summary`

**Query Parameters**:
- `startDate` - Required (YYYY-MM-DD)
- `endDate` - Required (YYYY-MM-DD)
- `format` - Optional: `json`, `pdf`, `csv` (default: json)

```json
Response:
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-01-01",
      "end": "2026-01-31"
    },
    "totalSales": "125000.00",
    "totalCost": "75000.00",
    "grossProfit": "50000.00",
    "profitMargin": "40.00",
    "transactionCount": 450,
    "averageTransaction": "277.78",
    "byPaymentMethod": {
      "CASH": "80000.00",
      "CARD": "30000.00",
      "MOBILE_MONEY": "15000.00"
    },
    "byDay": [
      {
        "date": "2026-01-01",
        "sales": "4200.00",
        "transactions": 15
      }
    ]
  }
}
```

### Inventory Valuation Report

**GET** `/api/reports/inventory-valuation`

**Query Parameters**:
- `asOfDate` - Optional (YYYY-MM-DD, defaults to today)
- `costingMethod` - Optional: FIFO, AVCO
- `format` - Optional: `json`, `pdf`, `csv`

```json
Response:
{
  "success": true,
  "data": {
    "asOfDate": "2026-01-29",
    "totalValue": "450000.00",
    "products": [
      {
        "sku": "PROD-001",
        "name": "Product X",
        "quantityOnHand": 150,
        "averageCost": "95.00",
        "totalValue": "14250.00"
      }
    ]
  }
}
```

### Profit & Loss Report

**GET** `/api/reports/profit-loss`

**Query Parameters**:
- `startDate` - Required
- `endDate` - Required
- `format` - Optional

```json
Response:
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-01-01",
      "end": "2026-01-31"
    },
    "revenue": {
      "sales": "125000.00",
      "total": "125000.00"
    },
    "costOfGoodsSold": "75000.00",
    "grossProfit": "50000.00",
    "grossProfitMargin": "40.00",
    "expenses": {
      "salaries": "15000.00",
      "rent": "5000.00",
      "utilities": "2000.00",
      "total": "22000.00"
    },
    "netProfit": "28000.00",
    "netProfitMargin": "22.40"
  }
}
```

---

## ❌ Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

### HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate or constraint violation
- `500 Internal Server Error` - Server error

### Example Error Responses

**Validation Error**:
```json
{
  "success": false,
  "error": "Validation failed: email is required"
}
```

**Authorization Error**:
```json
{
  "success": false,
  "error": "Insufficient permissions. ADMIN role required."
}
```

**Business Rule Error**:
```json
{
  "success": false,
  "error": "Cannot complete sale: Insufficient stock for product 'Product X'"
}
```

---

## 🔄 Pagination

List endpoints support pagination:

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

**Response**:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5
  }
}
```

---

## 🔍 Search & Filters

### Products Search

**GET** `/api/products?search=laptop&category=Electronics`

### Date Range Filters

**GET** `/api/sales?startDate=2026-01-01&endDate=2026-01-31`

### Sorting

**GET** `/api/products?sortBy=name&sortOrder=asc`

---

## 📝 Notes

1. **All dates are in ISO 8601 format** (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
2. **All amounts are decimal strings** to preserve precision
3. **UUIDs are lowercase** without hyphens in some contexts
4. **Tax calculation is automatic** based on product.taxRate
5. **FEFO batch selection is automatic** unless batchId specified
6. **Profit excludes tax** (calculated as: subtotal - discount - cost)

---

**Last Updated**: January 29, 2026
**Version**: 1.0.0
