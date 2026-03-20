-- ============================================================================
-- Quotations Feature
-- Single table with JSONB items for lightweight quote management
-- Status lifecycle: DRAFT → SENT → ACCEPTED → REJECTED / EXPIRED / CONVERTED
-- ============================================================================

-- Quotation status enum
DO $$ BEGIN
  CREATE TYPE quotation_status AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Quotation number sequence
CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START WITH 1;

-- Quotations table
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,

    -- JSONB items array: [{productId, productName, sku, quantity, unitPrice, taxRate, discountAmount, notes}]
    items JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Financial summary (pre-calculated from items for fast queries)
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    -- Validity
    valid_until DATE,
    
    -- Status tracking
    status quotation_status NOT NULL DEFAULT 'DRAFT',
    converted_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,

    -- Metadata
    notes TEXT,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_quotation_amounts CHECK (
        subtotal >= 0 AND tax_amount >= 0 AND discount_amount >= 0 AND total_amount >= 0
    )
);

-- Auto-generate quotation number
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quotation_number IS NULL OR NEW.quotation_number = '' THEN
        NEW.quotation_number := 'QT-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('quotation_number_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quotation_number ON quotations;
CREATE TRIGGER trg_quotation_number
    BEFORE INSERT ON quotations
    FOR EACH ROW
    EXECUTE FUNCTION generate_quotation_number();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quotation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quotation_updated_at ON quotations;
CREATE TRIGGER trg_quotation_updated_at
    BEFORE UPDATE ON quotations
    FOR EACH ROW
    EXECUTE FUNCTION update_quotation_timestamp();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at);
CREATE INDEX IF NOT EXISTS idx_quotations_valid_until ON quotations(valid_until);
CREATE INDEX IF NOT EXISTS idx_quotations_converted_sale_id ON quotations(converted_sale_id);
