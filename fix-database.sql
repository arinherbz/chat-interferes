-- Run this SQL to fix missing tables for images and Face ID
-- Option 1: Run manually in your SQLite browser
-- Option 2: Reset database (deletes all data but fixes everything)

-- ==================== MEDIA ASSETS TABLE (for image uploads) ====================
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  folder TEXT NOT NULL DEFAULT 'misc',
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  data_base64 TEXT NOT NULL,
  shop_id TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS media_assets_folder_idx ON media_assets(folder);
CREATE INDEX IF NOT EXISTS media_assets_shop_idx ON media_assets(shop_id);

-- ==================== WEBAUTHN CREDENTIALS (for Face ID) ====================
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  credential_id TEXT NOT NULL,
  credential_public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type TEXT,
  transports TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS webauthn_user_idx ON webauthn_credentials(user_id);

-- ==================== VERIFY TABLES EXIST ====================
SELECT 'Tables created successfully' as status;
SELECT COUNT(*) as media_assets_count FROM media_assets;
SELECT COUNT(*) as webauthn_count FROM webauthn_credentials;
