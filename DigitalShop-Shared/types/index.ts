// Centralized exports for all TypeScript types
// All types are inferred from Zod schemas to ensure validation and type safety are synchronized

export type {
  UserRole,
  User,
  CreateUser,
  UpdateUser,
  Login,
  ChangePassword,
} from '../zod/user';

export type {
  CostingMethod,
  Product,
  CreateProduct,
  UpdateProduct,
} from '../zod/product';

export type {
  Customer,
  CreateCustomer,
  UpdateCustomer,
} from '../zod/customer';

export type {
  SaleStatus,
  PaymentMethod,
  SaleItem,
  Sale,
  CreateSale,
} from '../zod/sale';

export type {
  Supplier,
  CreateSupplier,
  UpdateSupplier,
} from '../zod/supplier';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
