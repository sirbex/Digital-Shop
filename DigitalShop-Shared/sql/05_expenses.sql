-- ============================================================================
-- DIGITALSHOP EXPENSES MODULE
-- ============================================================================
-- Expense tracking for business operations
-- Categories: Rent, Utilities, Salaries, Supplies, Transport, Marketing, etc.
-- ============================================================================

-- ============================================================================
-- EXPENSE CATEGORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed default expense categories
INSERT INTO expense_categories (name, description) VALUES
    ('Rent', 'Office/store rent payments'),
    ('Utilities', 'Electricity, water, internet, phone bills'),
    ('Salaries', 'Employee wages and benefits'),
    ('Supplies', 'Office supplies, packaging materials'),
    ('Transport', 'Delivery, fuel, vehicle maintenance'),
    ('Marketing', 'Advertising, promotions, marketing materials'),
    ('Repairs & Maintenance', 'Equipment repairs, building maintenance'),
    ('Insurance', 'Business, property, liability insurance'),
    ('Taxes & Licenses', 'Business taxes, permits, licenses'),
    ('Professional Services', 'Accounting, legal, consulting fees'),
    ('Bank Charges', 'Transaction fees, account maintenance'),
    ('Miscellaneous', 'Other business expenses')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_number VARCHAR(50) UNIQUE NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method payment_method NOT NULL DEFAULT 'CASH',
    vendor_name VARCHAR(255),
    reference_number VARCHAR(100),
    receipt_url TEXT,
    notes TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurring_frequency VARCHAR(50),
    status VARCHAR(20) DEFAULT 'APPROVED',
    created_by_id UUID REFERENCES users(id),
    approved_by_id UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_expense_amount CHECK (amount > 0),
    CONSTRAINT chk_expense_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_number ON expenses(expense_number);

-- Sequence for expense numbers
CREATE SEQUENCE IF NOT EXISTS expense_number_seq START WITH 1;

-- Function to generate expense number
CREATE OR REPLACE FUNCTION generate_expense_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    current_year INTEGER;
    next_seq INTEGER;
    expense_num VARCHAR(50);
BEGIN
    current_year := EXTRACT(YEAR FROM NOW());
    next_seq := nextval('expense_number_seq');
    expense_num := 'EXP-' || current_year || '-' || LPAD(next_seq::TEXT, 4, '0');
    RETURN expense_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate expense number
CREATE OR REPLACE FUNCTION set_expense_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expense_number IS NULL OR NEW.expense_number = '' THEN
        NEW.expense_number := generate_expense_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_expense_number ON expenses;
CREATE TRIGGER trg_set_expense_number
BEFORE INSERT ON expenses
FOR EACH ROW
EXECUTE FUNCTION set_expense_number();

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE expense_categories IS 'Predefined categories for expense classification';
COMMENT ON TABLE expenses IS 'Business expense records for tracking operational costs';
COMMENT ON COLUMN expenses.expense_number IS 'Auto-generated unique identifier (EXP-YYYY-####)';
COMMENT ON COLUMN expenses.is_recurring IS 'Flag for recurring expenses (rent, utilities)';
COMMENT ON COLUMN expenses.recurring_frequency IS 'Frequency: DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY';

-- Verification
SELECT 'Expenses module created successfully!' AS status;
SELECT COUNT(*) || ' expense categories seeded' AS result FROM expense_categories;
