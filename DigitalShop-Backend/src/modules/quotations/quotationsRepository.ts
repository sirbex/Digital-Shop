import pool from '../../db/pool.js';

export interface QuotationRow {
  id: string;
  quotation_number: string;
  customer_id: string | null;
  customer_name: string;
  items: string; // JSONB as string
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  valid_until: string | null;
  status: string;
  converted_sale_id: string | null;
  notes: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export const quotationsRepository = {
  async getAll(filters?: {
    status?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<QuotationRow[]> {
    let query = `
      SELECT q.*, u.full_name as created_by_name
      FROM quotations q
      LEFT JOIN users u ON q.created_by_id = u.id
      WHERE 1=1
    `;
    const values: any[] = [];
    let idx = 1;

    if (filters?.status && filters.status !== 'ALL') {
      query += ` AND q.status = $${idx++}`;
      values.push(filters.status);
    }
    if (filters?.customerId) {
      query += ` AND q.customer_id = $${idx++}`;
      values.push(filters.customerId);
    }
    if (filters?.startDate) {
      query += ` AND q.created_at >= $${idx++}`;
      values.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ` AND q.created_at <= $${idx++}::date + interval '1 day'`;
      values.push(filters.endDate);
    }

    query += ` ORDER BY q.created_at DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  },

  async getById(id: string): Promise<QuotationRow | null> {
    const query = `
      SELECT q.*, u.full_name as created_by_name
      FROM quotations q
      LEFT JOIN users u ON q.created_by_id = u.id
      WHERE q.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  },

  async create(data: {
    customerId?: string | null;
    customerName: string;
    items: any[];
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    validUntil?: string;
    notes?: string;
    createdById: string;
  }): Promise<QuotationRow> {
    const query = `
      INSERT INTO quotations (
        customer_id, customer_name, items,
        subtotal, tax_amount, discount_amount, total_amount,
        valid_until, notes, created_by_id
      )
      VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *, (SELECT full_name FROM users WHERE id = $10) as created_by_name
    `;
    const result = await pool.query(query, [
      data.customerId || null,
      data.customerName,
      JSON.stringify(data.items),
      data.subtotal,
      data.taxAmount,
      data.discountAmount,
      data.totalAmount,
      data.validUntil || null,
      data.notes || null,
      data.createdById,
    ]);
    return result.rows[0];
  },

  async update(id: string, data: {
    customerId?: string | null;
    customerName?: string;
    items?: any[];
    subtotal?: number;
    taxAmount?: number;
    discountAmount?: number;
    totalAmount?: number;
    validUntil?: string | null;
    notes?: string | null;
  }): Promise<QuotationRow | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.customerId !== undefined) {
      updates.push(`customer_id = $${idx++}`);
      values.push(data.customerId);
    }
    if (data.customerName !== undefined) {
      updates.push(`customer_name = $${idx++}`);
      values.push(data.customerName);
    }
    if (data.items !== undefined) {
      updates.push(`items = $${idx++}::jsonb`);
      values.push(JSON.stringify(data.items));
    }
    if (data.subtotal !== undefined) {
      updates.push(`subtotal = $${idx++}`);
      values.push(data.subtotal);
    }
    if (data.taxAmount !== undefined) {
      updates.push(`tax_amount = $${idx++}`);
      values.push(data.taxAmount);
    }
    if (data.discountAmount !== undefined) {
      updates.push(`discount_amount = $${idx++}`);
      values.push(data.discountAmount);
    }
    if (data.totalAmount !== undefined) {
      updates.push(`total_amount = $${idx++}`);
      values.push(data.totalAmount);
    }
    if (data.validUntil !== undefined) {
      updates.push(`valid_until = $${idx++}`);
      values.push(data.validUntil);
    }
    if (data.notes !== undefined) {
      updates.push(`notes = $${idx++}`);
      values.push(data.notes);
    }

    if (updates.length === 0) return this.getById(id);

    values.push(id);
    const query = `
      UPDATE quotations
      SET ${updates.join(', ')}
      WHERE id = $${idx} AND status IN ('DRAFT', 'SENT')
      RETURNING *
    `;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return null;

    // Re-fetch with join for created_by_name
    return this.getById(id);
  },

  async updateStatus(id: string, status: string, convertedSaleId?: string): Promise<QuotationRow | null> {
    let query: string;
    let values: any[];

    if (convertedSaleId) {
      query = `
        UPDATE quotations
        SET status = $1, converted_sale_id = $2
        WHERE id = $3
        RETURNING *
      `;
      values = [status, convertedSaleId, id];
    } else {
      query = `
        UPDATE quotations
        SET status = $1
        WHERE id = $2
        RETURNING *
      `;
      values = [status, id];
    }

    const result = await pool.query(query, values);
    if (result.rows.length === 0) return null;
    return this.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM quotations WHERE id = $1 AND status = 'DRAFT'`,
      [id]
    );
    return (result.rowCount || 0) > 0;
  },
};
