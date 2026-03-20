-- ============================================================================
-- TRIGGER REPAIR TOOL — Recalculate All Computed Fields
-- ============================================================================
-- Use when data is inconsistent or after manual DB edits.
-- Like SAP's report RABDNACH (recalculate all derived data).
--
-- Usage:
--   psql -U postgres -d digitalshop -f trigger_repair.sql
--
-- This calls every _internal() function for every record, forcing a full
-- recalculation from source-of-truth tables.
-- ============================================================================

DO $$
DECLARE
    v_count INT;
    r RECORD;
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '  TRIGGER REPAIR — Full Recalculation of All Computed Fields  ';
    RAISE NOTICE '  Started at: %', NOW();
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';

    -- 1. Recalculate all customer balances
    RAISE NOTICE '── Recalculating customer balances ──';
    v_count := 0;
    FOR r IN SELECT id FROM customers LOOP
        PERFORM fn_update_customer_balance_internal(r.id);
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE '   ✓ Recalculated % customers', v_count;

    -- 2. Recalculate all supplier balances
    RAISE NOTICE '── Recalculating supplier balances ──';
    v_count := 0;
    FOR r IN SELECT id FROM suppliers LOOP
        PERFORM fn_update_supplier_balance_internal(r.id);
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE '   ✓ Recalculated % suppliers', v_count;

    -- 3. Recalculate all product quantities
    RAISE NOTICE '── Recalculating product quantities ──';
    v_count := 0;
    FOR r IN SELECT id FROM products LOOP
        PERFORM fn_update_inventory_quantity_internal(r.id);
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE '   ✓ Recalculated % products', v_count;

    -- 4. Recalculate all invoice balances
    RAISE NOTICE '── Recalculating invoice balances ──';
    v_count := 0;
    FOR r IN SELECT id FROM invoices LOOP
        PERFORM fn_update_invoice_balance_internal(r.id);
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE '   ✓ Recalculated % invoices', v_count;

    -- 5. Recalculate all sale totals
    RAISE NOTICE '── Recalculating sale totals ──';
    v_count := 0;
    FOR r IN SELECT id FROM sales LOOP
        PERFORM fn_update_sale_totals_internal(r.id);
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE '   ✓ Recalculated % sales', v_count;

    -- 6. Recalculate all PO totals
    RAISE NOTICE '── Recalculating purchase order totals ──';
    v_count := 0;
    FOR r IN SELECT id FROM purchase_orders LOOP
        PERFORM fn_update_po_totals_internal(r.id);
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE '   ✓ Recalculated % purchase orders', v_count;

    -- 7. Recalculate all GR totals
    RAISE NOTICE '── Recalculating goods receipt totals ──';
    v_count := 0;
    FOR r IN SELECT id FROM goods_receipts LOOP
        PERFORM fn_update_gr_totals_internal(r.id);
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE '   ✓ Recalculated % goods receipts', v_count;

    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '  REPAIR COMPLETE at: %', NOW();
    RAISE NOTICE '  Now run trigger_healthcheck.sql to verify consistency.';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;
