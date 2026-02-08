-- ============================================================================
-- MIGRATION: Add refunds and refund_items tables
-- ============================================================================
-- Required by the sales refund flow in salesRepository.ts
-- These tables track refund records and the individual items refunded.
-- ============================================================================

-- Refund type enum
DO $$ BEGIN
    CREATE TYPE refund_type AS ENUM ('FULL', 'PARTIAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Refund reason enum
DO $$ BEGIN
    CREATE TYPE refund_reason AS ENUM (
        'CUSTOMER_REQUEST',
        'DAMAGED_PRODUCT',
        'WRONG_PRODUCT',
        'QUALITY_ISSUE',
        'PRICING_ERROR',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Refund status enum
DO $$ BEGIN
    CREATE TYPE refund_status AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- REFUNDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    refund_type refund_type NOT NULL DEFAULT 'FULL',
    refund_reason refund_reason NOT NULL DEFAULT 'OTHER',
    refund_amount DECIMAL(15, 2) NOT NULL,
    return_to_inventory BOOLEAN DEFAULT true,
    status refund_status DEFAULT 'COMPLETED',
    notes TEXT,
    processed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_refund_amount CHECK (refund_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_refunds_sale ON refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_processed_by ON refunds(processed_by);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at);

COMMENT ON TABLE refunds IS 'Refund records linked to sales transactions';
COMMENT ON COLUMN refunds.refund_amount IS 'Total refund amount for this refund operation';
COMMENT ON COLUMN refunds.return_to_inventory IS 'Whether refunded items should be returned to inventory stock';

-- ============================================================================
-- REFUND ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS refund_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
    sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
    quantity_refunded DECIMAL(15, 4) NOT NULL,
    refund_amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_refund_item_quantity CHECK (quantity_refunded > 0),
    CONSTRAINT chk_refund_item_amount CHECK (refund_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_refund_items_refund ON refund_items(refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_sale_item ON refund_items(sale_item_id);

COMMENT ON TABLE refund_items IS 'Individual line items within a refund, linked to original sale_items';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Refunds tables created successfully!' AS status;

SELECT 
    tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('refunds', 'refund_items')
ORDER BY tablename;
