#!/bin/bash
# Neon Database Migration Script for Ariostore
# This adds Face ID and image upload tables to your Neon PostgreSQL database

set -e

echo "🚀 Ariostore Neon Database Migration"
echo "===================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable not set"
    echo ""
    echo "Please set it first:"
    echo "export DATABASE_URL='postgresql://user:password@host/database?sslmode=require'"
    echo ""
    echo "You can find this in:"
    echo "1. Neon Dashboard → Connection Details"
    echo "2. Render Dashboard → Environment Variables"
    exit 1
fi

echo "✅ DATABASE_URL found"
echo ""

# Extract connection details for display
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\).*/\1/p')
echo "📍 Database Host: $DB_HOST"
echo ""

# Check if psql is available
if command -v psql &> /dev/null; then
    echo "🔧 Running migration using psql..."
    psql "$DATABASE_URL" -f neon-migration.sql
    echo ""
    echo "✅ Migration complete!"
else
    echo "⚠️  psql not found. You'll need to run the SQL manually."
    echo ""
    echo "Option 1: Neon SQL Editor"
    echo "  1. Go to https://console.neon.tech"
    echo "  2. Open your project → SQL Editor"
    echo "  3. Copy and paste the contents of neon-migration.sql"
    echo "  4. Click Run"
    echo ""
    echo "Option 2: Install psql"
    echo "  macOS: brew install libpq"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "  Then run: psql \"\$DATABASE_URL\" -f neon-migration.sql"
fi

echo ""
echo "===================================="
echo "🎉 Done!"
echo "===================================="
echo ""
echo "Next steps:"
echo "1. Deploy your code to Render: git push origin main"
echo "2. Render will automatically pick up the new tables"
echo "3. Test image uploads"
echo "4. Test Face ID login (on mobile)"
