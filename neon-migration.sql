-- Neon PostgreSQL Migration for Ariostore
-- Run this in Neon SQL Editor or using psql
-- This adds tables for Face ID and image uploads

-- ==================== WEBAUTHN CREDENTIALS (Face ID / Touch ID) ====================
-- Stores biometric authentication credentials
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    credential_id TEXT NOT NULL,
    credential_public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    device_type VARCHAR(50),
    transports TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS webauthn_user_idx ON webauthn_credentials(user_id);

COMMENT ON TABLE webauthn_credentials IS 'Stores Face ID / Touch ID / Fingerprint credentials for users';

-- ==================== MEDIA ASSETS (Image Uploads) ====================
-- Stores uploaded images as base64 data
CREATE TABLE IF NOT EXISTS media_assets (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    folder TEXT NOT NULL DEFAULT 'misc',
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    data_base64 TEXT NOT NULL,
    shop_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS media_assets_folder_idx ON media_assets(folder);
CREATE INDEX IF NOT EXISTS media_assets_shop_idx ON media_assets(shop_id);

COMMENT ON TABLE media_assets IS 'Stores uploaded images and files as base64 data';

-- ==================== VERIFY TABLES CREATED ====================
SELECT 'webauthn_credentials table created' as status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webauthn_credentials');

SELECT 'media_assets table created' as status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media_assets');

-- ==================== LIST ALL TABLES ====================
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;
