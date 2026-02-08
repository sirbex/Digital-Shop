-- Fix: Profit calculation must exclude tax and include cart-level discounts
-- Previously: lineProfit included tax; cart-level discounts were ignored in profit calc

CREATE OR REPLACE FUNCTION fn_update_sale_totals_internal(p_sale_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_amount NUMERIC;
    v_total_cost NUMERIC;
    v_item_discount NUMERIC;
    v_sale_discount NUMERIC;
    v_total_discount NUMERIC;
    v_profit NUMERIC;
    v_profit_margin NUMERIC;
    v_tax_amount NUMERIC;
    v_subtotal NUMERIC;
BEGIN
    -- Get the existing tax_amount and discount_amount from the sale
    -- The sale-level discount_amount may include cart-level discounts that
    -- are NOT distributed to individual sale_items
    SELECT tax_amount, discount_amount 
    INTO v_tax_amount, v_sale_discount 
    FROM sales WHERE id = p_sale_id;
    v_tax_amount := COALESCE(v_tax_amount, 0);
    v_sale_discount := COALESCE(v_sale_discount, 0);
    
    -- Calculate totals from sale items (item-level discounts only)
    SELECT 
        COALESCE(SUM(quantity * unit_price), 0),
        COALESCE(SUM(quantity * COALESCE(unit_cost, 0)), 0),
        COALESCE(SUM(COALESCE(discount_amount, 0)), 0)
    INTO v_subtotal, v_total_cost, v_item_discount
    FROM sale_items
    WHERE sale_id = p_sale_id;
    
    -- Use the GREATER of sale-level discount vs item-level discount sum
    -- Cart-level discounts only exist on sales.discount_amount, not on sale_items
    v_total_discount := GREATEST(v_sale_discount, v_item_discount);
    
    -- Calculate TOTAL including tax: (subtotal - discount) + tax
    v_total_amount := v_subtotal - v_total_discount + v_tax_amount;
    
    -- Calculate profit EXCLUDING tax (tax is government money, not profit)
    -- Profit = Revenue - Cost, where Revenue = Subtotal - ALL Discounts (before tax)
    v_profit := (v_subtotal - v_total_discount) - v_total_cost;
    
    -- Calculate profit margin as decimal ratio (0.25 = 25%)
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
END;
$$ LANGUAGE plpgsql;
