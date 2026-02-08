import { z } from 'zod';

// User roles enum
export const UserRoleEnum = z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'STAFF']);

// Base user schema - aligned with database schema
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string(),
  fullName: z.string().min(1).max(255),
  role: UserRoleEnum,
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

// Schema for creating a new user
export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required').max(255),
  role: UserRoleEnum.optional().default('CASHIER'),
}).strict();

// Schema for updating a user
export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(1).max(255).optional(),
  role: UserRoleEnum.optional(),
  isActive: z.boolean().optional(),
}).strict();

// Schema for login
export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
}).strict();

// Schema for password change
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
}).strict();

// Inferred types
export type UserRole = z.infer<typeof UserRoleEnum>;
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
