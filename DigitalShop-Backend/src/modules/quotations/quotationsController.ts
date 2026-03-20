import { Request, Response } from 'express';
import { z } from 'zod';
import { quotationsService } from './quotationsService.js';
import { logger } from '../../utils/logger.js';
import {
  CreateQuotationSchema,
  UpdateQuotationSchema,
} from '../../../../DigitalShop-Shared/dist/zod/quotation.js';

export const quotationsController = {
  /**
   * GET /api/quotations
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        customerId: req.query.customerId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };

      const quotations = await quotationsService.getAll(filters);
      res.json({ success: true, data: quotations });
    } catch (error: any) {
      logger.error('Error in getAll quotations:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch quotations' });
    }
  },

  /**
   * GET /api/quotations/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const quotation = await quotationsService.getById(id);

      if (!quotation) {
        res.status(404).json({ success: false, error: 'Quotation not found' });
        return;
      }

      res.json({ success: true, data: quotation });
    } catch (error: any) {
      logger.error('Error in getById quotation:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch quotation' });
    }
  },

  /**
   * POST /api/quotations
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const validated = CreateQuotationSchema.parse(req.body);

      const quotation = await quotationsService.create({
        customerId: validated.customerId ?? null,
        customerName: validated.customerName,
        items: validated.items.map(i => ({
          ...i,
          productId: i.productId ?? null,
        })),
        validUntil: validated.validUntil,
        notes: validated.notes,
        createdById: userId,
      });

      res.status(201).json({
        success: true,
        data: quotation,
        message: 'Quotation created successfully',
      });
    } catch (error: any) {
      logger.error('Error in create quotation:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: error.errors[0].message });
        return;
      }

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create quotation',
      });
    }
  },

  /**
   * PUT /api/quotations/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validated = UpdateQuotationSchema.parse(req.body);

      const quotation = await quotationsService.update(id, {
        ...validated,
        items: validated.items?.map(i => ({
          ...i,
          productId: i.productId ?? null,
        })),
      });

      if (!quotation) {
        res.status(404).json({ success: false, error: 'Quotation not found or not editable' });
        return;
      }

      res.json({
        success: true,
        data: quotation,
        message: 'Quotation updated successfully',
      });
    } catch (error: any) {
      logger.error('Error in update quotation:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: error.errors[0].message });
        return;
      }

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update quotation',
      });
    }
  },

  /**
   * PATCH /api/quotations/:id/status
   */
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const statusSchema = z.object({
        status: z.enum(['SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED']),
      });
      const { status } = statusSchema.parse(req.body);

      const quotation = await quotationsService.updateStatus(id, status);

      if (!quotation) {
        res.status(404).json({ success: false, error: 'Quotation not found' });
        return;
      }

      res.json({
        success: true,
        data: quotation,
        message: `Quotation status updated to ${status}`,
      });
    } catch (error: any) {
      logger.error('Error in updateStatus quotation:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: error.errors[0].message });
        return;
      }

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update quotation status',
      });
    }
  },

  /**
   * POST /api/quotations/:id/convert
   * Convert accepted quotation to sale
   */
  async convertToSale(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const convertSchema = z.object({
        paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CREDIT', 'CHECK']),
        amountPaid: z.number().nonnegative(),
      });
      const { paymentMethod, amountPaid } = convertSchema.parse(req.body);
      const userId = (req as any).user?.id;

      // Get quotation
      const quotation = await quotationsService.getById(id);
      if (!quotation) {
        res.status(404).json({ success: false, error: 'Quotation not found' });
        return;
      }
      if (quotation.status !== 'ACCEPTED') {
        res.status(400).json({ success: false, error: 'Only ACCEPTED quotations can be converted' });
        return;
      }

      // Build CreateSaleData from quotation items
      const saleItems = quotation.items.map((item) => ({
        productId: item.productId || undefined,
        itemType: item.productId ? 'PRODUCT' : 'CUSTOM',
        customDescription: item.productId ? undefined : item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount || 0,
        // Quotation stores taxRate as percentage (18), sale expects decimal (0.18)
        taxRate: (item.taxRate || 0) / 100,
      }));

      // Create sale via sales module
      const { createSale } = await import('../sales/salesService.js');
      const pool = (await import('../../db/pool.js')).default;

      const saleId = await createSale(pool, {
        customerId: quotation.customerId || undefined,
        customerName: quotation.customerName,
        paymentMethod: paymentMethod as any,
        amountPaid,
        cashierId: userId,
        notes: `Converted from quotation ${quotation.quotationNumber}`,
        items: saleItems,
      });

      // Mark quotation as converted
      await quotationsService.convertToSale(id, saleId);

      res.status(201).json({
        success: true,
        data: { saleId, quotationId: id },
        message: `Quotation converted to sale successfully`,
      });
    } catch (error: any) {
      logger.error('Error in convertToSale:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: error.errors[0].message });
        return;
      }

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to convert quotation to sale',
      });
    }
  },

  /**
   * DELETE /api/quotations/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await quotationsService.delete(id);

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Quotation not found or not deletable (must be DRAFT)' });
        return;
      }

      res.json({ success: true, message: 'Quotation deleted successfully' });
    } catch (error: any) {
      logger.error('Error in delete quotation:', error);
      res.status(500).json({ success: false, error: 'Failed to delete quotation' });
    }
  },
};
