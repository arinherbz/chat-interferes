#!/bin/bash
# Ariostore Image Upload & Display Fix Script
# Run this in your chat-interferes project directory

set -e

echo "🔧 Ariostore Photo Fix Script"
echo "=============================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. Are you in the chat-interferes directory?"
  exit 1
fi

echo "✅ Found project directory"
echo ""

# 1. Create uploads directory
echo "📁 Step 1: Creating uploads directory..."
mkdir -p uploads
mkdir -p uploads/product-images
mkdir -p uploads/trade-ins
mkdir -p uploads/misc
chmod -R 755 uploads
echo "✅ Uploads directory created"
echo ""

# 2. Check if database exists
DB_FILE=".data/dev.sqlite"

if [ -f "$DB_FILE" ]; then
  echo "📊 Step 2: Checking database..."
  
  # Check if media_assets table exists
  TABLE_EXISTS=$(sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' AND name='media_assets';" 2>/dev/null || echo "")
  
  if [ -z "$TABLE_EXISTS" ]; then
    echo "⚠️  media_assets table missing. Creating..."
    
    sqlite3 "$DB_FILE" <<EOF
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
EOF
    echo "✅ media_assets table created"
  else
    echo "✅ media_assets table exists"
  fi
  
  # Check if webauthn_credentials table exists (for Face ID)
  WEBAUTHN_EXISTS=$(sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' AND name='webauthn_credentials';" 2>/dev/null || echo "")
  
  if [ -z "$WEBAUTHN_EXISTS" ]; then
    echo "⚠️  webauthn_credentials table missing. Creating..."
    
    sqlite3 "$DB_FILE" <<EOF
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
EOF
    echo "✅ webauthn_credentials table created"
  fi
  
  echo ""
fi

# 3. Check server uploads.ts configuration
echo "🔍 Step 3: Checking server configuration..."

if [ -f "server/uploads.ts" ]; then
  echo "✅ uploads.ts found"
  
  # Check if uploadRoot is properly set
  if grep -q "uploadRoot" server/uploads.ts; then
    echo "✅ Upload root configuration found"
  else
    echo "⚠️  Upload root configuration may be missing"
  fi
else
  echo "❌ uploads.ts not found!"
  exit 1
fi

echo ""

# 4. Verify directory structure
echo "📂 Step 4: Verifying directory structure..."
echo "   Project root: $(pwd)"
echo "   Uploads path: $(pwd)/uploads"
echo "   Database path: $(pwd)/$DB_FILE"
echo ""

# 5. Test permissions
echo "🔐 Step 5: Testing write permissions..."
if touch uploads/.test_write 2>/dev/null; then
  rm uploads/.test_write
  echo "✅ Write permissions OK"
else
  echo "❌ Cannot write to uploads folder!"
  echo "   Fix: chmod 755 uploads"
  exit 1
fi
echo ""

# 6. Summary
echo "=============================="
echo "✅ Fix Complete!"
echo "=============================="
echo ""
echo "Next steps:"
echo "1. Restart your server: npm run dev"
echo "2. Login to admin panel"
echo "3. Go to Products → Add Product"
echo "4. Upload an image and check if it displays"
echo ""
echo "If images still don't show:"
echo "- Check browser console for errors (F12 → Console)"
echo "- Verify image URL in Network tab (F12 → Network)"
echo "- Try accessing image URL directly in browser"
echo ""
echo "For HTTPS/localhost testing:"
echo "   npm install -g local-ssl-proxy"
echo "   local-ssl-proxy --source 5001 --target 5000"
echo ""

# Count existing images if database exists
if [ -f "$DB_FILE" ]; then
  IMAGE_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM media_assets;" 2>/dev/null || echo "0")
  echo "📊 Current images in database: $IMAGE_COUNT"
fi

echo ""
echo "Done! 🎉"
