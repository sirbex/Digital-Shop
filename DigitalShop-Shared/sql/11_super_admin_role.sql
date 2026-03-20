-- ============================================================================
-- MIGRATION: Add SUPER_ADMIN role
-- ============================================================================

-- 1. Add SUPER_ADMIN to user_role ENUM
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN' BEFORE 'ADMIN';

-- 2. Add Super Administrator RBAC role (all permissions, cannot be deleted)
INSERT INTO roles (id, name, description, is_system_role) VALUES
    ('00000000-0000-0000-0000-000000000000', 'Super Administrator', 'Unrestricted system access — highest privilege level', true)
ON CONFLICT (name) DO NOTHING;

-- 3. Grant ALL permissions to Super Administrator
INSERT INTO role_permissions (role_id, permission_key)
SELECT '00000000-0000-0000-0000-000000000000', key FROM permissions
ON CONFLICT DO NOTHING;

-- 4. Promote existing admin user to SUPER_ADMIN
UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'admin@digitalshop.com';

SELECT 'SUPER_ADMIN role migration complete' AS status;
