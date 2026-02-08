-- ============================================================================
-- DIGITALSHOP COMPREHENSIVE DATABASE TRIGGERS
-- ============================================================================
-- All business logic is maintained at the DATABASE level for consistency.
-- Frontend displays data calculated by database - NO frontend calculations.
-- 
-- CRITICAL: Includes fixed tax calculation trigger (tax preserved from sales table)
-- ============================================================================

-- ============================================================================
-- 0. UTILITY FUNCTIONS
-- ============================================================================

-- Generate unique movement number for stock_movements (SM-YYYY-######)
CREATE OR REPLACE FUNCTION generate_movement_number()
RETURNS VARCHAR AS $$
DECLARE
    v_sequence INT;
    v_prefix VARCHAR := 'SM';
    v_year VARCHAR := TO_CHAR(CURRENT_DATE, 'YYYY');
BEGIN
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(
        CASE 
            WHEN movement_number LIKE 'SM-' || v_year || '-%' THEN
                NULLIF(REGEXP_REPLACE(SUBSTRING(movement_number FROM 9), '[^0-9]', '', 'g'), '')::INT
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM stock_movements;
    
    RETURN v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. CUSTOMER BALANCE TRIGGERS
-- Customer balance is ALWAYS calculated from their transactions
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_recalculate_customer_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
BEGIN
    -- Determine which customer to update
    IF TG_TABLE_NAME = 'sales' THEN
        IF TG_OP = 'DELETE' THEN
            v_customer_id := OLD.customer_id;
        ELSE
            v_customer_id := NEW.customer_id;
            -- Also handle customer change
            IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id AND OLD.customer_id IS NOT NULL THEN
                PERFORM fn_update_customer_balance_internal(OLD.customer_id);
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'invoice_payments' THEN
        IF TG_OP = 'DELETE' THEN
            v_customer_id := (SELECT customer_id FROM invoices WHERE id = OLD.invoice_id);
        ELSE
            v_customer_id := (SELECT customer_id FROM invoices WHERE id = NEW.invoice_id);
        END IF;
    ELSIF TG_TABLE_NAME = 'invoices' THEN
        IF TG_OP = 'DELETE' THEN
            v_customer_id := OLD.customer_id;
        ELSE
            v_customer_id := NEW.customer_id;
        END IF;
    END IF;
    
    IF v_customer_id IS NOT NULL THEN
        PERFORM fn_update_customer_balance_internal(v_customer_id);
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_customer_balance_internal(p_customer_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_unpaid_invoices NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- =========================================================================
    -- CRITICAL FIX: Use invoices table as single source of truth for balance
    -- Balance = sum of amount_due from all unpaid/partially paid invoices
    -- =========================================================================
    SELECT COALESCE(SUM(amount_due), 0)
    INTO v_total_unpaid_invoices
    FROM invoices
    WHERE customer_id = p_customer_id
      AND status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE');
    
    -- Customer balance = total unpaid invoices (negative = customer owes money)
    v_new_balance := -v_total_unpaid_invoices;
    
    -- Update customer balance
    UPDATE customers
    SET balance = v_new_balance,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_customer_id;
    
    RAISE NOTICE 'Updated customer % balance to % (unpaid invoices: %)', 
        p_customer_id, v_new_balance, v_total_unpaid_invoices;
END;
$$ LANGUAGE plpgsql;

-- Trigger on sales for customer balance
DROP TRIGGER IF EXISTS trg_sync_customer_balance_on_sale ON sales;
CREATE TRIGGER trg_sync_customer_balance_on_sale
    AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION fn_recalculate_customer_balance();

-- Trigger on invoice_payments for customer balance
DROP TRIGGER IF EXISTS trg_sync_customer_balance_on_payment ON invoice_payments;
CREATE TRIGGER trg_sync_customer_balance_on_payment
    AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
    FOR EACH ROW
    EXECUTE FUNCTION fn_recalculate_customer_balance();

-- Trigger on invoices for customer balance (CRITICAL FIX)
-- When invoice is created/updated/deleted, recalculate customer balance
DROP TRIGGER IF EXISTS trg_sync_customer_balance_on_invoice ON invoices;
CREATE TRIGGER trg_sync_customer_balance_on_invoice
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION fn_recalculate_customer_balance();

-- ============================================================================
-- 2. SUPPLIER BALANCE TRIGGERS
-- Supplier balance tracks amounts owed to suppliers
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_recalculate_supplier_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_supplier_id UUID;
BEGIN
    -- Determine which supplier to update
    IF TG_TABLE_NAME = 'purchase_orders' THEN
        IF TG_OP = 'DELETE' THEN
            v_supplier_id := OLD.supplier_id;
        ELSE
            v_supplier_id := NEW.supplier_id;
        END IF;
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

CREATE OR REPLACE FUNCTION fn_update_supplier_balance_internal(p_supplier_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_purchases NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- Sum all completed/received purchase orders
    -- POs go to RECEIVED (via goods receipt finalization) or COMPLETED
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_purchases
    FROM purchase_orders
    WHERE supplier_id = p_supplier_id
      AND status IN ('COMPLETED', 'RECEIVED', 'PARTIAL');
    
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

-- Trigger on purchase_orders for supplier balance
DROP TRIGGER IF EXISTS trg_sync_supplier_balance ON purchase_orders;
CREATE TRIGGER trg_sync_supplier_balance
    AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION fn_recalculate_supplier_balance();

-- ============================================================================
-- 3. INVENTORY QUANTITY TRIGGERS
-- Product stock quantities are ALWAYS calculated from batch data
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_recalculate_inventory_quantity()
RETURNS TRIGGER AS $$
DECLARE
    v_product_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_product_id := OLD.product_id;
    ELSE
        v_product_id := NEW.product_id;
        IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
            PERFORM fn_update_inventory_quantity_internal(OLD.product_id);
        END IF;
    END IF;
    
    IF v_product_id IS NOT NULL THEN
        PERFORM fn_update_inventory_quantity_internal(v_product_id);
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_inventory_quantity_internal(p_product_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_quantity NUMERIC;
BEGIN
    -- Sum remaining quantity from all ACTIVE batches
    SELECT COALESCE(SUM(remaining_quantity), 0)
    INTO v_total_quantity
    FROM inventory_batches
    WHERE product_id = p_product_id
      AND status = 'ACTIVE';
    
    -- Update product quantity_on_hand
    UPDATE products
    SET quantity_on_hand = v_total_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_product_id;
    
    RAISE NOTICE 'Updated product % quantity to %', p_product_id, v_total_quantity;
END;
$$ LANGUAGE plpgsql;

-- Trigger on inventory_batches for product quantity
DROP TRIGGER IF EXISTS trg_sync_inventory_quantity ON inventory_batches;
CREATE TRIGGER trg_sync_inventory_quantity
    AFTER INSERT OR UPDATE OR DELETE ON inventory_batches
    FOR EACH ROW
    EXECUTE FUNCTION fn_recalculate_inventory_quantity();

-- ============================================================================
-- 4. SALE TOTALS TRIGGER (CRITICAL - INCLUDES TAX FIX)
-- Sale total, cost, and profit are calculated from sale_items
-- TAX is PRESERVED from sales table (user input), NOT recalculated
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_recalculate_sale_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_sale_id UUID;
BEGIN
    -- Determine which sale to update
    IF TG_OP = 'DELETE' THEN
        v_sale_id := OLD.sale_id;
    ELSE
        v_sale_id := NEW.sale_id;
        -- Handle sale change on UPDATE
        IF TG_OP = 'UPDATE' AND OLD.sale_id IS DISTINCT FROM NEW.sale_id THEN
            PERFORM fn_update_sale_totals_internal(OLD.sale_id);
        END IF;
    END IF;
    
    IF v_sale_id IS NOT NULL THEN
        PERFORM fn_update_sale_totals_internal(v_sale_id);
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_sale_totals_internal(p_sale_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_amount NUMERIC;
    v_total_cost NUMERIC;
    v_total_discount NUMERIC;
    v_profit NUMERIC;
    v_profit_margin NUMERIC;
    v_tax_amount NUMERIC;
    v_subtotal NUMERIC;
BEGIN
    -- ========================================================================
    -- CRITICAL FIX: Get the existing tax_amount from the sale (preserve user input)
    -- ========================================================================
    SELECT tax_amount INTO v_tax_amount FROM sales WHERE id = p_sale_id;
    v_tax_amount := COALESCE(v_tax_amount, 0);
    
    -- Calculate totals from sale items
    SELECT 
        COALESCE(SUM(quantity * unit_price), 0),
        COALESCE(SUM(quantity * COALESCE(unit_cost, 0)), 0),
        COALESCE(SUM(COALESCE(discount_amount, 0)), 0)
    INTO v_subtotal, v_total_cost, v_total_discount
    FROM sale_items
    WHERE sale_id = p_sale_id;
    
    -- ========================================================================
    -- CRITICAL FIX: Calculate TOTAL including tax: (subtotal - discount) + tax
    -- ========================================================================
    v_total_amount := v_subtotal - v_total_discount + v_tax_amount;
    
    -- ========================================================================
    -- CRITICAL FIX: Calculate profit EXCLUDING tax (tax is government money, not profit)
    -- Profit = Revenue - Cost, where Revenue = Subtotal - Discount (before tax)
    -- ========================================================================
    v_profit := (v_subtotal - v_total_discount) - v_total_cost;
    
    -- Calculate profit margin as decimal ratio (0.25 = 25%)
    -- Margin based on revenue BEFORE tax
    IF (v_subtotal - v_total_discount) > 0 THEN
        v_profit_margin := v_profit / (v_subtotal - v_total_discount);
    ELSE
        v_profit_margin := 0;
    END IF;
    
    -- Update sale record
    UPDATE sales
    SET total_amount = v_total_amount,
        total_cost = v_total_cost,
        profit = v_profit,
        profit_margin = v_profit_margin,
        discount_amount = v_total_discount
    WHERE id = p_sale_id;
    
    RAISE NOTICE 'Updated sale % totals: subtotal=%, tax=%, total=%, cost=%, profit=%', 
        p_sale_id, v_subtotal - v_total_discount, v_tax_amount, v_total_amount, v_total_cost, v_profit;
END;
$$ LANGUAGE plpgsql;

-- Trigger on sale_items for sale totals
DROP TRIGGER IF EXISTS trg_sync_sale_totals ON sale_items;
CREATE TRIGGER trg_sync_sale_totals
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION fn_recalculate_sale_totals();

-- ============================================================================
-- 5. PURCHASE ORDER TOTALS TRIGGER
-- PO total is calculated from po_items
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_recalculate_po_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_po_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_po_id := OLD.purchase_order_id;
    ELSE
        v_po_id := NEW.purchase_order_id;
        IF TG_OP = 'UPDATE' AND OLD.purchase_order_id IS DISTINCT FROM NEW.purchase_order_id THEN
            PERFORM fn_update_po_totals_internal(OLD.purchase_order_id);
        END IF;
    END IF;
    
    IF v_po_id IS NOT NULL THEN
        PERFORM fn_update_po_totals_internal(v_po_id);
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_po_totals_internal(p_po_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_amount NUMERIC;
BEGIN
    SELECT COALESCE(SUM(total_price), 0)
    INTO v_total_amount
    FROM purchase_order_items
    WHERE purchase_order_id = p_po_id;
    
    UPDATE purchase_orders
    SET total_amount = v_total_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_po_id;
    
    RAISE NOTICE 'Updated PO % total to %', p_po_id, v_total_amount;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_po_totals ON purchase_order_items;
CREATE TRIGGER trg_sync_po_totals
    AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
    FOR EACH ROW
    EXECUTE FUNCTION fn_recalculate_po_totals();

-- ============================================================================
-- 6. GOODS RECEIPT TOTALS TRIGGER
-- GR total is calculated from gr_items
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_recalculate_gr_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_gr_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_gr_id := OLD.goods_receipt_id;
    ELSE
        v_gr_id := NEW.goods_receipt_id;
        IF TG_OP = 'UPDATE' AND OLD.goods_receipt_id IS DISTINCT FROM NEW.goods_receipt_id THEN
            PERFORM fn_update_gr_totals_internal(OLD.goods_receipt_id);
        END IF;
    END IF;
    
    IF v_gr_id IS NOT NULL THEN
        PERFORM fn_update_gr_totals_internal(v_gr_id);
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_gr_totals_internal(p_gr_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_value NUMERIC;
BEGIN
    SELECT COALESCE(SUM(received_quantity * cost_price), 0)
    INTO v_total_value
    FROM goods_receipt_items
    WHERE goods_receipt_id = p_gr_id;
    
    UPDATE goods_receipts
    SET total_value = v_total_value,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_gr_id;
    
    RAISE NOTICE 'Updated GR % total to %', p_gr_id, v_total_value;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_gr_totals ON goods_receipt_items;
CREATE TRIGGER trg_sync_gr_totals
    AFTER INSERT OR UPDATE OR DELETE ON goods_receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION fn_recalculate_gr_totals();

-- ============================================================================
-- 7. INVOICE BALANCE TRIGGER
-- Invoice balance = total - payments received
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_recalculate_invoice_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_invoice_id := OLD.invoice_id;
    ELSE
        v_invoice_id := NEW.invoice_id;
    END IF;
    
    IF v_invoice_id IS NOT NULL THEN
        PERFORM fn_update_invoice_balance_internal(v_invoice_id);
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_invoice_balance_internal(p_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_amount NUMERIC;
    v_total_paid NUMERIC;
    v_balance NUMERIC;
    v_new_status invoice_status;
BEGIN
    -- Get invoice total
    SELECT COALESCE(total_amount, 0)
    INTO v_total_amount
    FROM invoices
    WHERE id = p_invoice_id;
    
    -- Sum payments for this invoice
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM invoice_payments
    WHERE invoice_id = p_invoice_id;
    
    v_balance := v_total_amount - v_total_paid;
    
    -- Determine status
    IF v_balance <= 0 THEN
        v_new_status := 'PAID';
    ELSIF v_total_paid > 0 THEN
        v_new_status := 'PARTIALLY_PAID';
    ELSE
        -- Keep existing status if no payment yet (could be DRAFT, SENT, OVERDUE)
        SELECT status INTO v_new_status FROM invoices WHERE id = p_invoice_id;
        IF v_new_status = 'PAID' OR v_new_status = 'PARTIALLY_PAID' THEN
            v_new_status := 'SENT';
        END IF;
    END IF;
    
    -- Update invoice
    UPDATE invoices
    SET amount_paid = v_total_paid,
        amount_due = GREATEST(v_balance, 0),
        status = v_new_status,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_invoice_id;
    
    RAISE NOTICE 'Updated invoice % balance to %, status=%', p_invoice_id, v_balance, v_new_status;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_invoice_balance ON invoice_payments;
CREATE TRIGGER trg_sync_invoice_balance
    AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
    FOR EACH ROW
    EXECUTE FUNCTION fn_recalculate_invoice_balance();

-- ============================================================================
-- 8. STOCK MOVEMENT AUDIT TRIGGER
-- Automatically log all stock movements
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_log_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_movement_type movement_type;
    v_quantity_change NUMERIC;
    v_reference_type TEXT;
    v_reference_id UUID;
    v_movement_number VARCHAR;
BEGIN
    -- Skip if no actual change in quantity
    IF TG_OP = 'UPDATE' AND NEW.remaining_quantity = OLD.remaining_quantity THEN
        RETURN NEW;
    END IF;
    
    -- Generate movement number (SM-YYYY-######)
    v_movement_number := generate_movement_number();
    
    -- Determine movement type and quantity
    IF TG_OP = 'INSERT' THEN
        v_movement_type := 'GOODS_RECEIPT'::movement_type;
        v_quantity_change := NEW.remaining_quantity;
        v_reference_type := COALESCE(NEW.source_type, 'GOODS_RECEIPT');
        v_reference_id := NEW.source_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_quantity_change := NEW.remaining_quantity - OLD.remaining_quantity;
        IF v_quantity_change > 0 THEN
            v_movement_type := 'ADJUSTMENT_IN'::movement_type;
        ELSIF v_quantity_change < 0 THEN
            v_movement_type := 'SALE'::movement_type;
            v_quantity_change := ABS(v_quantity_change);
        ELSE
            RETURN NEW; -- No change, skip logging
        END IF;
        v_reference_type := 'ADJUSTMENT';
        v_reference_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        v_movement_type := 'DAMAGE'::movement_type;
        v_quantity_change := OLD.remaining_quantity;
        v_reference_type := 'BATCH_DELETE';
        v_reference_id := OLD.id;
    END IF;
    
    -- Insert stock movement record
    INSERT INTO stock_movements (
        id, movement_number, product_id, batch_id, movement_type, quantity,
        reference_type, reference_id, created_at
    ) VALUES (
        uuid_generate_v4(),
        v_movement_number,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
        v_movement_type,
        v_quantity_change,
        v_reference_type,
        v_reference_id,
        CURRENT_TIMESTAMP
    );
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- stock_movements table doesn't exist, skip logging
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_stock_movement ON inventory_batches;
CREATE TRIGGER trg_log_stock_movement
    AFTER INSERT OR UPDATE OR DELETE ON inventory_batches
    FOR EACH ROW
    EXECUTE FUNCTION fn_log_stock_movement();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'DigitalShop comprehensive triggers installed successfully!' AS status;

SELECT 
    event_object_table as table_name,
    COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_sync%'
GROUP BY event_object_table
ORDER BY event_object_table;
