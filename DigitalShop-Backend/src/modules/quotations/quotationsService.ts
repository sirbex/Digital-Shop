import { quotationsRepository, QuotationRow } from './quotationsRepository.js';
import { logger } from '../../utils/logger.js';
import Decimal from 'decimal.js';

export interface QuotationItem {
  productId: string | null;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  notes?: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string | null;
  customerName: string;
  items: QuotationItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  validUntil: string | null;
  status: string;
  convertedSaleId: string | null;
  notes: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

function toQuotation(row: QuotationRow): Quotation {
  const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
  return {
    id: row.id,
    quotationNumber: row.quotation_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    items: Array.isArray(items) ? items : [],
    subtotal: parseFloat(row.subtotal),
    taxAmount: parseFloat(row.tax_amount),
    discountAmount: parseFloat(row.discount_amount),
    totalAmount: parseFloat(row.total_amount),
    validUntil: row.valid_until,
    status: row.status,
    convertedSaleId: row.converted_sale_id,
    notes: row.notes,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Calculate financial totals from items using Decimal.js
 */
function calculateTotals(items: QuotationItem[]) {
  let subtotal = new Decimal(0);
  let taxAmount = new Decimal(0);
  let discountAmount = new Decimal(0);

  for (const item of items) {
    const lineSubtotal = new Decimal(item.unitPrice).times(item.quantity);
    const lineDiscount = new Decimal(item.discountAmount || 0);
    const taxableAmount = lineSubtotal.minus(lineDiscount);
    const lineTax = taxableAmount.times(new Decimal(item.taxRate || 0).div(100));

    subtotal = subtotal.plus(lineSubtotal);
    taxAmount = taxAmount.plus(lineTax);
    discountAmount = discountAmount.plus(lineDiscount);
  }

  const totalAmount = subtotal.minus(discountAmount).plus(taxAmount);

  return {
    subtotal: subtotal.toDecimalPlaces(2).toNumber(),
    taxAmount: taxAmount.toDecimalPlaces(2).toNumber(),
    discountAmount: discountAmount.toDecimalPlaces(2).toNumber(),
    totalAmount: totalAmount.toDecimalPlaces(2).toNumber(),
  };
}

export const quotationsService = {
  async getAll(filters?: {
    status?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Quotation[]> {
    const rows = await quotationsRepository.getAll(filters);
    return rows.map(toQuotation);
  },

  async getById(id: string): Promise<Quotation | null> {
    const row = await quotationsRepository.getById(id);
    return row ? toQuotation(row) : null;
  },

  async create(data: {
    customerId?: string | null;
    customerName: string;
    items: QuotationItem[];
    validUntil?: string;
    notes?: string;
    createdById: string;
  }): Promise<Quotation> {
    const totals = calculateTotals(data.items);

    const row = await quotationsRepository.create({
      customerId: data.customerId,
      customerName: data.customerName,
      items: data.items,
      ...totals,
      validUntil: data.validUntil,
      notes: data.notes,
      createdById: data.createdById,
    });

    logger.info('Quotation created', { quotationNumber: row.quotation_number });
    return toQuotation(row);
  },

  async update(id: string, data: {
    customerId?: string | null;
    customerName?: string;
    items?: QuotationItem[];
    validUntil?: string | null;
    notes?: string | null;
  }): Promise<Quotation | null> {
    // Verify quotation exists and is editable
    const existing = await quotationsRepository.getById(id);
    if (!existing) throw new Error('Quotation not found');
    if (!['DRAFT', 'SENT'].includes(existing.status)) {
      throw new Error('Only DRAFT or SENT quotations can be edited');
    }

    const updateData: any = {};
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.customerName !== undefined) updateData.customerName = data.customerName;
    if (data.validUntil !== undefined) updateData.validUntil = data.validUntil;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (data.items) {
      updateData.items = data.items;
      const totals = calculateTotals(data.items);
      Object.assign(updateData, totals);
    }

    const row = await quotationsRepository.update(id, updateData);
    if (!row) return null;
    logger.info('Quotation updated', { id });
    return toQuotation(row);
  },

  async updateStatus(id: string, newStatus: string): Promise<Quotation | null> {
    const existing = await quotationsRepository.getById(id);
    if (!existing) throw new Error('Quotation not found');

    // Validate status transitions
    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ['SENT', 'ACCEPTED'],
      SENT: ['ACCEPTED', 'REJECTED'],
      ACCEPTED: ['CONVERTED'],
      REJECTED: [],
      EXPIRED: [],
      CONVERTED: [],
    };

    const allowed = allowedTransitions[existing.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition from ${existing.status} to ${newStatus}`);
    }

    const row = await quotationsRepository.updateStatus(id, newStatus);
    if (!row) return null;
    logger.info('Quotation status updated', { id, from: existing.status, to: newStatus });
    return toQuotation(row);
  },

  async convertToSale(id: string, saleId: string): Promise<Quotation | null> {
    const existing = await quotationsRepository.getById(id);
    if (!existing) throw new Error('Quotation not found');
    if (existing.status !== 'ACCEPTED') {
      throw new Error('Only ACCEPTED quotations can be converted to sales');
    }

    const row = await quotationsRepository.updateStatus(id, 'CONVERTED', saleId);
    if (!row) return null;
    logger.info('Quotation converted to sale', { quotationId: id, saleId });
    return toQuotation(row);
  },

  async delete(id: string): Promise<boolean> {
    const deleted = await quotationsRepository.delete(id);
    if (deleted) {
      logger.info('Quotation deleted', { id });
    }
    return deleted;
  },
};
