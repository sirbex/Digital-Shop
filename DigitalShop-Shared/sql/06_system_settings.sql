-- ============================================================================
-- SYSTEM SETTINGS TABLE
-- ============================================================================
-- Single-row configuration table for business-wide settings
-- Used by Settings page (Admin only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Business Information
    business_name VARCHAR(255) NOT NULL DEFAULT 'DigitalShop',
    business_phone VARCHAR(50),
    business_email VARCHAR(255),
    business_address TEXT,

    -- Currency & Regional
    currency_code VARCHAR(10) NOT NULL DEFAULT 'UGX',
    currency_symbol VARCHAR(10) NOT NULL DEFAULT 'UGX',
    date_format VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
    time_format VARCHAR(10) NOT NULL DEFAULT '24h',
    timezone VARCHAR(100) NOT NULL DEFAULT 'Africa/Kampala',

    -- Tax Configuration
    tax_enabled BOOLEAN NOT NULL DEFAULT true,
    tax_name VARCHAR(100) NOT NULL DEFAULT 'VAT',
    tax_number VARCHAR(100),
    default_tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    tax_inclusive BOOLEAN NOT NULL DEFAULT false,

    -- Receipt Printing
    receipt_header_text TEXT DEFAULT '',
    receipt_footer_text TEXT DEFAULT 'Thank you for your business!',
    receipt_show_tax_breakdown BOOLEAN NOT NULL DEFAULT true,
    receipt_auto_print BOOLEAN NOT NULL DEFAULT false,
    receipt_paper_width INTEGER NOT NULL DEFAULT 80,

    -- Alerts
    low_stock_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_settings_singleton ON system_settings ((true));

-- Insert default settings row (only if empty)
INSERT INTO system_settings (business_name)
SELECT 'DigitalShop'
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'System settings table created successfully!' AS status;
