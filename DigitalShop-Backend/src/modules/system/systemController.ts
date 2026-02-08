import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';
import * as systemService from './systemService.js';

// ============================================================================
// GET /api/system/settings
// Get system settings
// ============================================================================
export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    const settings = await systemService.getSettings(pool);
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Failed to get system settings', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get settings',
    });
  }
}

// ============================================================================
// PATCH /api/system/settings
// Update system settings (partial update)
// ============================================================================
export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const updateSchema = z.object({
      businessName: z.string().min(1).max(255).optional(),
      businessPhone: z.string().max(50).nullable().optional(),
      businessEmail: z.string().email().max(255).nullable().optional(),
      businessAddress: z.string().max(1000).nullable().optional(),
      currencyCode: z.string().min(1).max(10).optional(),
      currencySymbol: z.string().min(1).max(10).optional(),
      dateFormat: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY']).optional(),
      timeFormat: z.enum(['24h', '12h']).optional(),
      timezone: z.string().min(1).max(100).optional(),
      taxEnabled: z.boolean().optional(),
      taxName: z.string().min(1).max(100).optional(),
      taxNumber: z.string().max(100).nullable().optional(),
      defaultTaxRate: z.number().min(0).max(100).optional(),
      taxInclusive: z.boolean().optional(),
      receiptHeaderText: z.string().max(500).nullable().optional(),
      receiptFooterText: z.string().max(500).nullable().optional(),
      receiptShowTaxBreakdown: z.boolean().optional(),
      receiptAutoPrint: z.boolean().optional(),
      receiptPaperWidth: z.number().int().min(58).max(80).optional(),
      lowStockAlertsEnabled: z.boolean().optional(),
      lowStockThreshold: z.number().int().min(0).max(99999).optional(),
    }).strict();

    const validated = updateSchema.parse(req.body);
    const settings = await systemService.updateSettings(pool, validated);

    res.json({
      success: true,
      data: settings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }
    logger.error('Failed to update system settings', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings',
    });
  }
}

// ============================================================================
// GET /api/system/stats
// Get database statistics overview
// ============================================================================
export async function getDatabaseStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await systemService.getDatabaseStats(pool);
    
    // Transform Record<string, number> to array of {name, count} for frontend
    const formatTableList = (data: Record<string, number>) =>
      Object.entries(data).map(([name, count]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        count,
      }));

    res.json({
      success: true,
      data: {
        databaseSize: stats.databaseSize,
        masterData: formatTableList(stats.masterData),
        transactionalData: formatTableList(stats.transactionalData),
        totalRecords: stats.totalRecords,
      },
    });
  } catch (error) {
    logger.error('Failed to get database stats', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get database stats',
    });
  }
}

// ============================================================================
// GET /api/system/reset/preview
// Preview what will be reset
// ============================================================================
export async function getResetPreview(req: Request, res: Response): Promise<void> {
  try {
    const preview = await systemService.getResetPreview(pool);
    
    // Transform Record<string, number> to array of {name, count} for frontend
    const formatTableList = (data: Record<string, number>) =>
      Object.entries(data).map(([name, count]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        count,
      }));

    res.json({
      success: true,
      data: {
        willBeCleared: formatTableList(preview.willBeCleared.transactionalData),
        willBePreserved: formatTableList(preview.willBePreserved.masterData),
      },
    });
  } catch (error) {
    logger.error('Failed to get reset preview', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get reset preview',
    });
  }
}

// ============================================================================
// POST /api/system/reset
// Execute full transaction reset (Admin only - DESTRUCTIVE)
// ============================================================================
export async function executeReset(req: Request, res: Response): Promise<void> {
  try {
    const resetSchema = z.object({
      confirmText: z.string(),
      reason: z.string().min(10, 'Reason must be at least 10 characters'),
    });

    const { confirmText, reason } = resetSchema.parse(req.body);

    const userId = (req as any).user?.id;
    logger.warn('System reset requested', { userId, reason });

    const result = await systemService.executeReset(pool, confirmText, reason);

    res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }
    logger.error('System reset failed', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'System reset failed',
    });
  }
}
