-- ============================================================================
-- TRIGGER HEALTH CHECK — Enterprise Data Consistency Verification
-- ============================================================================
-- Run this BEFORE and AFTER any trigger change.
-- Like SAP's SM21/SE06 consistency check or Odoo's data integrity verification.
--
-- Usage:
--   psql -U postgres -d digitalshop -f trigger_healthcheck.sql
--
-- Output: PASS/FAIL for each check with details on mismatches.
-- ============================================================================

DO $$
DECLARE
    v_pass INT := 0;
    v_fail INT := 0;
    v_count INT;
    v_msg TEXT;
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '  TRIGGER HEALTH CHECK — DigitalShop Data Consistency Audit   ';
    RAISE NOTICE '  Run at: %', NOW();
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';

    -- ========================================================================
    -- CHECK 1: All critical functions exist
    -- ========================================================================
    RAISE NOTICE '── CHECK 1: Critical Functions Exist ──';
    
    SELECT COUNT(*) INTO v_count FROM (
        SELECT unnest(ARRAY[
            'fn_update_customer_balance_internal',
            'fn_recalculate_customer_balance',
            'fn_update_supplier_balance_internal',
            'fn_recalculate_supplier_balance',
            'fn_recalculate_supplier_balance_on_payment',
            'fn_update_inventory_quantity_internal',
            'fn_recalculate_inventory_quantity',
            'fn_update_sale_totals_internal',
            'fn_recalculate_sale_totals',
            'fn_update_po_totals_internal',
            'fn_recalculate_po_totals',
            'fn_update_gr_totals_internal',
            'fn_recalculate_gr_totals',
            'fn_update_invoice_balance_internal',
            'fn_recalculate_invoice_balance',
            'fn_log_stock_movement',
            'generate_movement_number',
            'update_updated_at_column'
        ]) AS fn
        EXCEPT
        SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
    ) missing;
    
    IF v_count = 0 THEN
        RAISE NOTICE '   ✓ PASS — All 18 critical functions exist';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '   ✗ FAIL — % functions missing!', v_count;
        v_fail := v_fail + 1;
    END IF;

    -- ========================================================================
    -- CHECK 2: All critical triggers are attached
    -- ========================================================================
    RAISE NOTICE '── CHECK 2: Critical Triggers Attached ──';
    
    SELECT COUNT(*) INTO v_count FROM (
        SELECT unnest(ARRAY[
            'trg_sync_customer_balance_on_sale',
            'trg_sync_customer_balance_on_payment',
            'trg_sync_customer_balance_on_invoice',
            'trg_sync_supplier_balance',
            'trg_sync_inventory_quantity',
            'trg_log_stock_movement',
            'trg_sync_sale_totals',
            'trg_sync_po_totals',
            'trg_sync_gr_totals',
            'trg_sync_invoice_balance'
        ]) AS trg
        EXCEPT
        SELECT DISTINCT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public'
    ) missing;
    
    IF v_count = 0 THEN
        RAISE NOTICE '   ✓ PASS — All 10 critical triggers attached';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '   ✗ FAIL — % triggers missing!', v_count;
        v_fail := v_fail + 1;
    END IF;

    -- ========================================================================
    -- CHECK 3: Customer balances match invoice aggregation
    -- ========================================================================
    RAISE NOTICE '── CHECK 3: Customer Balances ──';
    
    SELECT COUNT(*) INTO v_count FROM (
        SELECT c.id, c.balance AS actual,
            -COALESCE(SUM(i.amount_due), 0) AS expected
        FROM customers c
        LEFT JOIN invoices i ON i.customer_id = c.id 
            AND i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
        GROUP BY c.id
        HAVING ABS(c.balance - (-COALESCE(SUM(i.amount_due), 0))) > 0.01
    ) mismatched;
    
    IF v_count = 0 THEN
        RAISE NOTICE '   ✓ PASS — All customer balances match invoice data';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '   ✗ FAIL — % customers have incorrect balance!', v_count;
        v_fail := v_fail + 1;
        -- Show details
        FOR v_msg IN
            SELECT format('     → %s (id=%s): actual=%s, expected=%s',
                c.name, LEFT(c.id::text, 8), c.balance,
                -COALESCE(SUM(i.amount_due), 0))
            FROM customers c
            LEFT JOIN invoices i ON i.customer_id = c.id 
                AND i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
            GROUP BY c.id, c.name, c.balance
            HAVING ABS(c.balance - (-COALESCE(SUM(i.amount_due), 0))) > 0.01
            LIMIT 5
        LOOP
            RAISE WARNING '%', v_msg;
        END LOOP;
    END IF;

    -- ========================================================================
    -- CHECK 4: Product quantities match inventory batch aggregation
    -- ========================================================================
    RAISE NOTICE '── CHECK 4: Product Quantities ──';
    
    SELECT COUNT(*) INTO v_count FROM (
        SELECT p.id, p.quantity_on_hand AS actual,
            COALESCE(SUM(ib.remaining_quantity), 0) AS expected
        FROM products p
        LEFT JOIN inventory_batches ib ON ib.product_id = p.id AND ib.status = 'ACTIVE'
        GROUP BY p.id
        HAVING ABS(p.quantity_on_hand - COALESCE(SUM(ib.remaining_quantity), 0)) > 0.01
    ) mismatched;
    
    IF v_count = 0 THEN
        RAISE NOTICE '   ✓ PASS — All product quantities match batch data';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '   ✗ FAIL — % products have incorrect quantity!', v_count;
        v_fail := v_fail + 1;
        FOR v_msg IN
            SELECT format('     → %s (id=%s): actual=%s, expected=%s',
                p.name, LEFT(p.id::text, 8), p.quantity_on_hand,
                COALESCE(SUM(ib.remaining_quantity), 0))
            FROM products p
            LEFT JOIN inventory_batches ib ON ib.product_id = p.id AND ib.status = 'ACTIVE'
            GROUP BY p.id, p.name, p.quantity_on_hand
            HAVING ABS(p.quantity_on_hand - COALESCE(SUM(ib.remaining_quantity), 0)) > 0.01
            LIMIT 5
        LOOP
            RAISE WARNING '%', v_msg;
        END LOOP;
    END IF;

    -- ========================================================================
    -- CHECK 5: Supplier balances match PO - payments aggregation
    -- ========================================================================
    RAISE NOTICE '── CHECK 5: Supplier Balances ──';
    
    SELECT COUNT(*) INTO v_count FROM (
        SELECT s.id, s.balance AS actual,
            COALESCE(po_sum.total, 0) - COALESCE(pay_sum.total, 0) AS expected
        FROM suppliers s
        LEFT JOIN (
            SELECT supplier_id, SUM(total_amount) AS total 
            FROM purchase_orders WHERE status IN ('RECEIVED', 'PARTIAL') 
            GROUP BY supplier_id
        ) po_sum ON po_sum.supplier_id = s.id
        LEFT JOIN (
            SELECT supplier_id, SUM(amount) AS total 
            FROM supplier_payments GROUP BY supplier_id
        ) pay_sum ON pay_sum.supplier_id = s.id
        WHERE ABS(s.balance - (COALESCE(po_sum.total, 0) - COALESCE(pay_sum.total, 0))) > 0.01
    ) mismatched;
    
    IF v_count = 0 THEN
        RAISE NOTICE '   ✓ PASS — All supplier balances match PO/payment data';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '   ✗ FAIL — % suppliers have incorrect balance!', v_count;
        v_fail := v_fail + 1;
        FOR v_msg IN
            SELECT format('     → %s (id=%s): actual=%s, expected=%s',
                s.name, LEFT(s.id::text, 8), s.balance,
                COALESCE(po_sum.total, 0) - COALESCE(pay_sum.total, 0))
            FROM suppliers s
            LEFT JOIN (
                SELECT supplier_id, SUM(total_amount) AS total 
                FROM purchase_orders WHERE status IN ('RECEIVED', 'PARTIAL') 
                GROUP BY supplier_id
            ) po_sum ON po_sum.supplier_id = s.id
            LEFT JOIN (
                SELECT supplier_id, SUM(amount) AS total 
                FROM supplier_payments GROUP BY supplier_id
            ) pay_sum ON pay_sum.supplier_id = s.id
            WHERE ABS(s.balance - (COALESCE(po_sum.total, 0) - COALESCE(pay_sum.total, 0))) > 0.01
            LIMIT 5
        LOOP
            RAISE WARNING '%', v_msg;
        END LOOP;
    END IF;

    -- ========================================================================
    -- CHECK 6: Invoice balances match payment aggregation
    -- ========================================================================
    RAISE NOTICE '── CHECK 6: Invoice Balances ──';
    
    SELECT COUNT(*) INTO v_count FROM (
        SELECT i.id, i.amount_paid AS actual_paid,
            COALESCE(SUM(ip.amount), 0) AS expected_paid
        FROM invoices i
        LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id
        GROUP BY i.id, i.amount_paid
        HAVING ABS(i.amount_paid - COALESCE(SUM(ip.amount), 0)) > 0.01
    ) mismatched;
    
    IF v_count = 0 THEN
        RAISE NOTICE '   ✓ PASS — All invoice balances match payment data';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '   ✗ FAIL — % invoices have incorrect amount_paid!', v_count;
        v_fail := v_fail + 1;
        FOR v_msg IN
            SELECT format('     → %s (id=%s): actual_paid=%s, expected_paid=%s',
                i.invoice_number, LEFT(i.id::text, 8), i.amount_paid,
                COALESCE(SUM(ip.amount), 0))
            FROM invoices i
            LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id
            GROUP BY i.id, i.invoice_number, i.amount_paid
            HAVING ABS(i.amount_paid - COALESCE(SUM(ip.amount), 0)) > 0.01
            LIMIT 5
        LOOP
            RAISE WARNING '%', v_msg;
        END LOOP;
    END IF;

    -- ========================================================================
    -- CHECK 7: Invoice status consistency
    -- ========================================================================
    RAISE NOTICE '── CHECK 7: Invoice Status Consistency ──';
    
    SELECT COUNT(*) INTO v_count FROM invoices
    WHERE (status = 'PAID' AND amount_due > 0.01)
       OR (status = 'PARTIALLY_PAID' AND (amount_paid <= 0.01 OR amount_due <= 0.01))
       OR (status IN ('DRAFT', 'SENT', 'OVERDUE') AND amount_paid > 0.01 AND amount_due > 0.01);
    
    IF v_count = 0 THEN
        RAISE NOTICE '   ✓ PASS — All invoice statuses are consistent';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '   ✗ FAIL — % invoices have inconsistent status!', v_count;
        v_fail := v_fail + 1;
    END IF;

    -- ========================================================================
    -- CHECK 8: No duplicate function definitions (same function in multiple schemas)
    -- ========================================================================
    RAISE NOTICE '── CHECK 8: No Duplicate Functions ──';
    
    SELECT COUNT(*) INTO v_count FROM (
        SELECT proname, COUNT(*) 
        FROM pg_proc 
        WHERE proname LIKE 'fn_%' AND pronamespace = 'public'::regnamespace
        GROUP BY proname, pronargs
        HAVING COUNT(*) > 1
    ) dupes;
    
    IF v_count = 0 THEN
        RAISE NOTICE '   ✓ PASS — No duplicate function definitions';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '   ✗ FAIL — % functions have duplicate definitions!', v_count;
        v_fail := v_fail + 1;
    END IF;

    -- ========================================================================
    -- CHECK 9: Sale totals match item aggregation (spot-check last 100 sales)
    -- ========================================================================
    RAISE NOTICE '── CHECK 9: Sale Totals (last 100 sales) ──';
    
    SELECT COUNT(*) INTO v_count FROM (
        SELECT s.id, s.total_cost AS actual_cost,
            COALESCE(SUM(si.quantity * COALESCE(si.unit_cost, 0)), 0) AS expected_cost
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE s.created_at > CURRENT_DATE - INTERVAL '90 days'
        GROUP BY s.id, s.total_cost
        HAVING ABS(s.total_cost - COALESCE(SUM(si.quantity * COALESCE(si.unit_cost, 0)), 0)) > 0.01
        LIMIT 100
    ) mismatched;
    
    IF v_count = 0 THEN
        RAISE NOTICE '   ✓ PASS — Sale totals match item aggregation';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '   ✗ FAIL — % recent sales have incorrect totals!', v_count;
        v_fail := v_fail + 1;
    END IF;

    -- ========================================================================
    -- CHECK 10: PO totals match line items
    -- ========================================================================
    RAISE NOTICE '── CHECK 10: Purchase Order Totals ──';
    
    SELECT COUNT(*) INTO v_count FROM (
        SELECT po.id, po.total_amount AS actual,
            COALESCE(SUM(poi.total_price), 0) AS expected
        FROM purchase_orders po
        LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
        GROUP BY po.id, po.total_amount
        HAVING ABS(po.total_amount - COALESCE(SUM(poi.total_price), 0)) > 0.01
    ) mismatched;
    
    IF v_count = 0 THEN
        RAISE NOTICE '   ✓ PASS — PO totals match line items';
        v_pass := v_pass + 1;
    ELSE
        RAISE WARNING '   ✗ FAIL — % POs have incorrect totals!', v_count;
        v_fail := v_fail + 1;
    END IF;

    -- ========================================================================
    -- SUMMARY
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '  RESULTS: % PASSED, % FAILED out of % checks', v_pass, v_fail, v_pass + v_fail;
    IF v_fail = 0 THEN
        RAISE NOTICE '  STATUS: ✓ ALL CHECKS PASSED — Data is consistent';
    ELSE
        RAISE WARNING '  STATUS: ✗ % CHECKS FAILED — Investigate above', v_fail;
    END IF;
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';

END $$;
