import { Response } from 'express';
import { ZodError } from 'zod';
import logger from './logger.js';

/**
 * Centralized error handling utility for controllers
 * Eliminates duplicate try-catch patterns across all controllers
 */

export function handleControllerError(
  res: Response,
  error: unknown,
  operation: string,
  statusCode = 500
): void {
  if (error instanceof ZodError) {
    logger.error(`Validation error in ${operation}`, { issues: error.issues });
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`${operation} error`, { error: errorMessage });
  
  res.status(statusCode).json({
    success: false,
    error: `Failed to ${operation}`,
  });
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string
): void {
  res.json({
    success: true,
    data,
    ...(message && { message }),
  });
}

export function sendError(
  res: Response,
  error: string,
  statusCode = 500
): void {
  res.status(statusCode).json({
    success: false,
    error,
  });
}
