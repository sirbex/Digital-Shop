-- Fix: Remove invalid 'COMPLETED' enum value from purchase_order_status comparison
-- The purchase_order_status enum only has: DRAFT, SENT, PARTIAL, RECEIVED, CANCELLED
-- The trigger was referencing 'COMPLETED' which doesn't exist in this enum

CREATE OR REPLACE FUNCTION fn_update_supplier_balance_internal(p_supplier_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_purchases NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- Sum all received purchase orders
    -- POs go to RECEIVED (via goods receipt finalization) or PARTIAL
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_purchases
    FROM purchase_orders
    WHERE supplier_id = p_supplier_id
      AND status IN ('RECEIVED', 'PARTIAL');
    
    -- For this simplified version, balance = unpaid purchases
    -- (In full system, would subtract supplier payments)
    v_new_balance := v_total_purchases;
    
    -- Update supplier balance
    UPDATE suppliers
    SET balance = v_new_balance,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_supplier_id;
    
    RAISE NOTICE 'Updated supplier % balance to %', p_supplier_id, v_new_balance;
END;
$$ LANGUAGE plpgsql;
