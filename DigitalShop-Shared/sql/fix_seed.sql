-- Insert default admin user (password: admin123)
-- Hash generated with bcrypt rounds=10
INSERT INTO users (email, password_hash, full_name, role) VALUES
('admin@digitalshop.com', '$2b$10$CDa/2yDxiwf9pqZFbWvJLuiPxlgOypZpTKi2HPRLbocTvebohBLWC', 'System Administrator', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

-- Default customer groups
INSERT INTO customer_groups (name, description, discount_percentage) VALUES
('Retail Customers', 'Standard retail customers', 0.0000),
('Wholesale Customers', 'Bulk buyers with 10% discount', 0.1000)
ON CONFLICT DO NOTHING;

-- Default cash register
INSERT INTO cash_registers (name, location) VALUES
('Main Register', 'Front Counter')
ON CONFLICT DO NOTHING;

SELECT email, full_name, role FROM users;
