-- ============================================================================
-- DIGITALSHOP SEED DATA (OPTIONAL)
-- ============================================================================
-- This file is intentionally left empty for you to add test data as needed.
-- The schema already includes:
-- - 1 admin user (admin@digitalshop.com / admin123)
-- - 2 default customer groups (Retail, Wholesale)
-- - 1 default cash register (Main Register)
--
-- You can add additional test data here such as:
-- - Sample products
-- - Test customers
-- - Test suppliers
-- ============================================================================

-- Example: Add sample products
-- INSERT INTO products (sku, name, description, category, cost_price, selling_price, is_taxable) VALUES
-- ('PROD-001', 'Sample Product 1', 'Description here', 'Category A', 100.00, 150.00, true),
-- ('PROD-002', 'Sample Product 2', 'Description here', 'Category B', 200.00, 300.00, true);

-- Example: Add test customers
-- INSERT INTO customers (name, email, phone, customer_group_id) VALUES
-- ('Test Customer 1', 'customer1@test.com', '1234567890', (SELECT id FROM customer_groups WHERE name = 'Retail Customers')),
-- ('Test Customer 2', 'customer2@test.com', '0987654321', (SELECT id FROM customer_groups WHERE name = 'Wholesale Customers'));

-- Example: Add test suppliers
-- INSERT INTO suppliers (name, contact_person, email, phone, payment_terms) VALUES
-- ('Supplier A', 'John Doe', 'john@suppliera.com', '1111111111', 'NET30'),
-- ('Supplier B', 'Jane Smith', 'jane@supplierb.com', '2222222222', 'NET60');

SELECT 'Seed data file ready for your custom data!' AS status;
