import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { logger } from '../../utils/logger.js';
import * as authRepository from './authRepository.js';

const JWT_SECRET: string = process.env.JWT_SECRET ?? (() => { throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start without it.'); })();
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '24h';
const SALT_ROUNDS = 10;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  role?: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
  };
}

/**
 * Authenticate user and generate JWT token
 */
export async function login(pool: Pool, credentials: LoginCredentials): Promise<AuthResponse> {
  const { email, password } = credentials;

  // Find user by email
  const user = await authRepository.findUserByEmail(pool, email);

  if (!user) {
    logger.warn('Login failed - user not found', { email });
    throw new Error('Invalid email or password');
  }

  if (!user.is_active) {
    logger.warn('Login failed - user inactive', { email });
    throw new Error('Account is inactive. Please contact administrator.');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    logger.warn('Login failed - invalid password', { email });
    throw new Error('Invalid email or password');
  }

  // Update last login timestamp
  await authRepository.updateLastLogin(pool, user.id);

  // Generate JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET as jwt.Secret,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );

  logger.info('User logged in successfully', { userId: user.id, email: user.email });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      isActive: user.is_active,
    },
  };
}

/**
 * Register new user
 */
export async function register(pool: Pool, data: RegisterData): Promise<AuthResponse> {
  const { email, password, fullName, role = 'STAFF' } = data;

  // Check if email already exists
  const exists = await authRepository.emailExists(pool, email);
  if (exists) {
    logger.warn('Registration failed - email already exists', { email });
    throw new Error('Email already registered');
  }

  // Validate password strength
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const user = await authRepository.createUser(pool, {
    email,
    passwordHash,
    fullName,
    role,
  });

  // Generate JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET as jwt.Secret,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );

  logger.info('User registered successfully', { userId: user.id, email });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      isActive: user.is_active,
    },
  };
}

/**
 * Verify JWT token and return user data
 */
export async function verifyToken(pool: Pool, token: string): Promise<AuthResponse['user']> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
    };

    // Get fresh user data from database
    const user = await authRepository.findUserById(pool, decoded.userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.is_active) {
      throw new Error('Account is inactive');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      isActive: user.is_active,
    };
  } catch (error) {
    console.error('Token verification failed', error);
    throw new Error('Invalid or expired token');
  }
}

/**
 * Change user password
 */
export async function changePassword(
  pool: Pool,
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Get user
  const user = await authRepository.findUserById(pool, userId);

  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

  if (!isPasswordValid) {
    throw new Error('Current password is incorrect');
  }

  // Validate new password
  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update password
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newPasswordHash, userId]
  );

  logger.info('Password changed successfully', { userId });
}

