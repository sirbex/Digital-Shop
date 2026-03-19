-- ============================================================================
-- SUPPLIER PAYMENTS
-- ============================================================================
-- Tracks payments made to suppliers against their outstanding balance
-- Balance = SUM(received PO amounts) - SUM(supplier payments)
-- ============================================================================

-- Supplier Payments Table
CREATE TABLE IF NOT EXISTS supplier_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),  -- optional PO link
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payment_method payment_method NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    reference_number VARCHAR(200),
    notes TEXT,
    processed_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_supplier_payment_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(payment_date);

-- ============================================================================
-- Update supplier balance trigger to subtract payments
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_update_supplier_balance_internal(p_supplier_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_purchases NUMERIC;
    v_total_payments NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- Sum all received purchase orders
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_purchases
    FROM purchase_orders
    WHERE supplier_id = p_supplier_id
      AND status IN ('RECEIVED', 'PARTIAL');

    -- Sum all payments made to this supplier
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_payments
    FROM supplier_payments
    WHERE supplier_id = p_supplier_id;

    -- Balance = purchases - payments (positive = we still owe)
    v_new_balance := v_total_purchases - v_total_payments;

    UPDATE suppliers
    SET balance = v_new_balance,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_supplier_id;

    RAISE NOTICE 'Updated supplier % balance to % (purchases: %, payments: %)',
        p_supplier_id, v_new_balance, v_total_purchases, v_total_payments;
END;
$$ LANGUAGE plpgsql;

-- Trigger: recalculate supplier balance when payments change
CREATE OR REPLACE FUNCTION fn_recalculate_supplier_balance_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_supplier_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_supplier_id := OLD.supplier_id;
    ELSE
        v_supplier_id := NEW.supplier_id;
    END IF;

    IF v_supplier_id IS NOT NULL THEN
        PERFORM fn_update_supplier_balance_internal(v_supplier_id);
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_supplier_balance_on_payment ON supplier_payments;
CREATE TRIGGER trg_sync_supplier_balance_on_payment
    AFTER INSERT OR UPDATE OR DELETE ON supplier_payments
    FOR EACH ROW
    EXECUTE FUNCTION fn_recalculate_supplier_balance_on_payment();
