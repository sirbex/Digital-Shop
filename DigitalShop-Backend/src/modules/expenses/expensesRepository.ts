import pool from '../../db/pool.js';

export interface ExpenseRow {
  id: string;
  expense_number: string;
  expense_date: string;
  category: string;
  description: string;
  amount: string;
  payment_method: string;
  vendor_name: string | null;
  reference_number: string | null;
  receipt_url: string | null;
  notes: string | null;
  is_recurring: boolean;
  recurring_frequency: string | null;
  status: string;
  created_by_id: string | null;
  created_by_name: string | null;
  approved_by_id: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const expensesRepository = {
  /**
   * Get all expenses with filters
   */
  async getAll(filters?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    paymentMethod?: string;
    status?: string;
  }): Promise<ExpenseRow[]> {
    let query = `
      SELECT 
        e.*,
        u.full_name as created_by_name,
        a.full_name as approved_by_name
      FROM expenses e
      LEFT JOIN users u ON e.created_by_id = u.id
      LEFT JOIN users a ON e.approved_by_id = a.id
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.startDate) {
      query += ` AND e.expense_date >= $${paramIndex++}`;
      values.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ` AND e.expense_date <= $${paramIndex++}`;
      values.push(filters.endDate);
    }

    if (filters?.category) {
      query += ` AND e.category = $${paramIndex++}`;
      values.push(filters.category);
    }

    if (filters?.paymentMethod) {
      query += ` AND e.payment_method = $${paramIndex++}`;
      values.push(filters.paymentMethod);
    }

    if (filters?.status) {
      query += ` AND e.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  },

  /**
   * Get expense by ID
   */
  async getById(id: string): Promise<ExpenseRow | null> {
    const query = `
      SELECT 
        e.*,
        u.full_name as created_by_name,
        a.full_name as approved_by_name
      FROM expenses e
      LEFT JOIN users u ON e.created_by_id = u.id
      LEFT JOIN users a ON e.approved_by_id = a.id
      WHERE e.id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  },

  /**
   * Create new expense
   * Also saves the category to expense_categories table if it's new
   */
  async create(data: {
    expenseDate: string;
    category: string;
    description: string;
    amount: number;
    paymentMethod: string;
    vendorName?: string;
    referenceNumber?: string;
    notes?: string;
    isRecurring?: boolean;
    recurringFrequency?: string;
    createdById: string;
  }): Promise<ExpenseRow> {
    // Ensure category exists in the database for future autocomplete
    await this.ensureCategoryExists(data.category);
    
    const query = `
      INSERT INTO expenses (
        expense_date, category, description, amount, payment_method,
        vendor_name, reference_number, notes, is_recurring, recurring_frequency,
        created_by_id, status, approved_by_id, approved_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'APPROVED', $11, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      data.expenseDate,
      data.category,
      data.description,
      data.amount,
      data.paymentMethod,
      data.vendorName || null,
      data.referenceNumber || null,
      data.notes || null,
      data.isRecurring || false,
      data.recurringFrequency || null,
      data.createdById,
    ]);

    return result.rows[0];
  },

  /**
   * Update expense
   * Also saves the category to expense_categories table if it's new
   */
  async update(id: string, data: {
    expenseDate?: string;
    category?: string;
    description?: string;
    amount?: number;
    paymentMethod?: string;
    vendorName?: string;
    referenceNumber?: string;
    notes?: string;
    isRecurring?: boolean;
    recurringFrequency?: string;
  }): Promise<ExpenseRow | null> {
    // If category is being updated, ensure it exists in the database
    if (data.category) {
      await this.ensureCategoryExists(data.category);
    }
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.expenseDate !== undefined) {
      updates.push(`expense_date = $${paramIndex++}`);
      values.push(data.expenseDate);
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(data.category);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.amount !== undefined) {
      updates.push(`amount = $${paramIndex++}`);
      values.push(data.amount);
    }
    if (data.paymentMethod !== undefined) {
      updates.push(`payment_method = $${paramIndex++}`);
      values.push(data.paymentMethod);
    }
    if (data.vendorName !== undefined) {
      updates.push(`vendor_name = $${paramIndex++}`);
      values.push(data.vendorName);
    }
    if (data.referenceNumber !== undefined) {
      updates.push(`reference_number = $${paramIndex++}`);
      values.push(data.referenceNumber);
    }
    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }
    if (data.isRecurring !== undefined) {
      updates.push(`is_recurring = $${paramIndex++}`);
      values.push(data.isRecurring);
    }
    if (data.recurringFrequency !== undefined) {
      updates.push(`recurring_frequency = $${paramIndex++}`);
      values.push(data.recurringFrequency);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    values.push(id);

    const query = `
      UPDATE expenses
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },

  /**
   * Delete expense
   */
  async delete(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  },

  /**
   * Get all expense categories
   */
  async getCategories(): Promise<ExpenseCategoryRow[]> {
    const query = `
      SELECT * FROM expense_categories
      WHERE is_active = true
      ORDER BY name
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  /**
   * Save a new category to the database (if it doesn't exist)
   * This is called automatically when creating/updating expenses with new categories
   */
  async ensureCategoryExists(categoryName: string): Promise<void> {
    if (!categoryName || categoryName.trim() === '') return;
    
    const query = `
      INSERT INTO expense_categories (name, description, is_active)
      VALUES ($1, $2, true)
      ON CONFLICT (name) DO NOTHING
    `;
    
    await pool.query(query, [
      categoryName.trim(),
      `Custom category: ${categoryName.trim()}`
    ]);
  },

  /**
   * Create a new category explicitly
   */
  async createCategory(data: { name: string; description?: string }): Promise<ExpenseCategoryRow> {
    const query = `
      INSERT INTO expense_categories (name, description, is_active)
      VALUES ($1, $2, true)
      ON CONFLICT (name) DO UPDATE SET
        description = COALESCE(EXCLUDED.description, expense_categories.description),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      data.name.trim(),
      data.description || `Custom category: ${data.name.trim()}`
    ]);
    
    return result.rows[0];
  },

  /**
   * Get expense summary
   */
  async getSummary(filters?: { startDate?: string; endDate?: string }): Promise<any> {
    let query = `
      SELECT 
        COUNT(*) as total_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM expenses
      WHERE status = 'APPROVED'
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.startDate) {
      query += ` AND expense_date >= $${paramIndex++}`;
      values.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ` AND expense_date <= $${paramIndex++}`;
      values.push(filters.endDate);
    }

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Get expenses grouped by category
   */
  async getByCategory(filters?: { startDate?: string; endDate?: string }): Promise<any[]> {
    let query = `
      SELECT 
        category,
        COUNT(*) as expense_count,
        SUM(amount) as total_amount
      FROM expenses
      WHERE status = 'APPROVED'
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.startDate) {
      query += ` AND expense_date >= $${paramIndex++}`;
      values.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ` AND expense_date <= $${paramIndex++}`;
      values.push(filters.endDate);
    }

    query += ` GROUP BY category ORDER BY total_amount DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  },
};
