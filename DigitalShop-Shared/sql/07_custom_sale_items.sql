-- ============================================================================
-- Migration: Support Custom / Service Sale Items (non-inventory)
-- ============================================================================
-- Allows POS to create sale items that are NOT linked to a product in inventory.
-- Use cases: repair shops, service charges, custom fees, miscellaneous items.
--
-- Changes:
--   1. sale_items.product_id: NOT NULL → NULLABLE
--   2. New column: item_type ENUM ('PRODUCT', 'SERVICE', 'CUSTOM')
--   3. New column: custom_description TEXT (used when product_id IS NULL)
--   4. CHECK constraint: product_id required when item_type = 'PRODUCT'
-- ============================================================================

-- 1. Create the item_type enum
DO $$ BEGIN
  CREATE TYPE sale_item_type AS ENUM ('PRODUCT', 'SERVICE', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add item_type column with default 'PRODUCT' (backward-compatible)
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS item_type sale_item_type NOT NULL DEFAULT 'PRODUCT';

-- 3. Add custom_description column
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS custom_description TEXT;

-- 4. Make product_id nullable
ALTER TABLE sale_items
  ALTER COLUMN product_id DROP NOT NULL;

-- 5. Add CHECK: product_id required for PRODUCT items, description required for SERVICE/CUSTOM
ALTER TABLE sale_items
  DROP CONSTRAINT IF EXISTS chk_sale_item_type_product;
ALTER TABLE sale_items
  ADD CONSTRAINT chk_sale_item_type_product
    CHECK (
      (item_type = 'PRODUCT' AND product_id IS NOT NULL)
      OR
      (item_type IN ('SERVICE', 'CUSTOM') AND custom_description IS NOT NULL AND LENGTH(TRIM(custom_description)) > 0)
    );

-- Done. Existing rows are all item_type='PRODUCT' with product_id set, so they pass the constraint.
