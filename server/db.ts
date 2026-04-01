import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;

import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";

let _db: any;
export let pool: pkg.Pool | undefined;
export let sqliteClient: any;
const databaseUrl = process.env.DATABASE_URL?.trim();
const usePostgres = !!databaseUrl && /^postgres(?:ql)?:\/\//i.test(databaseUrl);

function resolveSqlitePath(input?: string) {
  if (!input) {
    return path.resolve(process.cwd(), ".data", "dev.sqlite");
  }

  const normalized = input
    .replace(/^sqlite:(\/\/)?/i, "")
    .replace(/^file:/i, "");

  return path.isAbsolute(normalized)
    ? normalized
    : path.resolve(process.cwd(), normalized);
}

if (usePostgres) {
  pool = new Pool({ connectionString: databaseUrl });
  _db = drizzlePostgres(pool);
} else {
  const sqlitePath = resolveSqlitePath(databaseUrl);
  try {
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  } catch {}
  if (databaseUrl && !/^sqlite:(\/\/)?/i.test(databaseUrl) && !path.isAbsolute(databaseUrl) && !databaseUrl.startsWith(".")) {
    console.warn(`[db] Treating non-Postgres DATABASE_URL as a SQLite file path: "${databaseUrl}"`);
  }
  const sqlite = new Database(sqlitePath);
  sqliteClient = sqlite;
  // create minimal tables required by the server when using SQLite fallback
  try {
    // expose a gen_random_uuid() function in SQLite to mimic Postgres default
    try {
      // better-sqlite3 supports .function; expose helpers used by drizzle defaults
      sqlite.function("gen_random_uuid", () => (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
      sqlite.function("now", () => new Date().toISOString());
    } catch {}
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        pin TEXT,
        name TEXT,
        email TEXT,
        role TEXT DEFAULT 'Sales',
        status TEXT DEFAULT 'active',
        last_login_at TEXT,
        last_active_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        shop_id TEXT
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        theme TEXT DEFAULT 'system',
        currency TEXT DEFAULT 'UGX',
        date_format TEXT DEFAULT 'PPP',
        timezone TEXT DEFAULT 'UTC',
        default_branch_id TEXT,
        sidebar_collapsed INTEGER DEFAULT 0,
        density TEXT DEFAULT 'comfortable',
        dashboard_layout TEXT,
        accent_color TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_name TEXT,
        role TEXT,
        action TEXT,
        entity TEXT,
        entity_id TEXT,
        details TEXT,
        metadata TEXT,
        shop_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire TIMESTAMP NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        brand TEXT,
        model TEXT,
        slug TEXT UNIQUE,
        description TEXT,
        condition TEXT DEFAULT 'New',
        ram TEXT,
        storage TEXT,
        specs TEXT,
        featured INTEGER DEFAULT 0,
        is_published INTEGER DEFAULT 1,
        is_flash_deal INTEGER DEFAULT 0,
        flash_deal_price INTEGER,
        flash_deal_ends_at TEXT,
        popularity INTEGER DEFAULT 0,
        price INTEGER DEFAULT 0,
        cost_price INTEGER DEFAULT 0,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        sku TEXT,
        image_url TEXT,
        shop_id TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        imei TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL,
        storage TEXT NOT NULL,
        condition TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'In Stock',
        price INTEGER DEFAULT 0,
        cost INTEGER DEFAULT 0,
        added_at TEXT,
        warranty_period INTEGER,
        warranty_expires_at TEXT,
        shop_id TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        joined_at TEXT,
        total_purchases INTEGER DEFAULT 0,
        shop_id TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        sale_number TEXT NOT NULL UNIQUE,
        customer_id TEXT,
        customer_name TEXT,
        items TEXT NOT NULL,
        total_amount INTEGER DEFAULT 0,
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Completed',
        sold_by TEXT NOT NULL,
        shop_id TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS repairs (
        id TEXT PRIMARY KEY,
        repair_number TEXT NOT NULL UNIQUE,
        device_brand TEXT NOT NULL,
        device_model TEXT NOT NULL,
        imei TEXT NOT NULL,
        issue_description TEXT NOT NULL,
        repair_type TEXT NOT NULL,
        price INTEGER DEFAULT 0,
        cost INTEGER DEFAULT 0,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'Pending',
        customer_name TEXT,
        technician TEXT,
        shop_id TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount INTEGER DEFAULT 0,
        payment_method TEXT,
        date TEXT,
        recorded_by TEXT NOT NULL,
        shop_id TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS closures (
        id TEXT PRIMARY KEY,
        date TEXT,
        cash_expected INTEGER DEFAULT 0,
        cash_counted INTEGER DEFAULT 0,
        mtn_amount INTEGER DEFAULT 0,
        airtel_amount INTEGER DEFAULT 0,
        card_amount INTEGER DEFAULT 0,
        expenses_total INTEGER DEFAULT 0,
        variance INTEGER DEFAULT 0,
        submitted_by TEXT NOT NULL,
        submitted_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        proofs TEXT,
        shop_id TEXT,
        sales TEXT,
        repairs TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      
      CREATE TABLE IF NOT EXISTS shops (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        timezone TEXT,
        logo TEXT,
        cover_image TEXT,
        theme_color_primary TEXT,
        theme_color_accent TEXT,
        is_main INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'UGX',
        subscription_plan TEXT DEFAULT 'trial',
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS device_base_values (
        id TEXT PRIMARY KEY,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        storage TEXT NOT NULL,
        base_value INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        shop_id TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS condition_questions (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        question TEXT NOT NULL,
        options TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_required INTEGER DEFAULT 1,
        is_critical INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS trade_in_assessments (
        id TEXT PRIMARY KEY,
        trade_in_number TEXT NOT NULL UNIQUE,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        storage TEXT,
        color TEXT,
        imei TEXT NOT NULL,
        serial_number TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        customer_id TEXT,
        base_value INTEGER NOT NULL,
        condition_answers TEXT NOT NULL,
        condition_score INTEGER NOT NULL,
        calculated_offer INTEGER NOT NULL,
        final_offer INTEGER,
        decision TEXT NOT NULL,
        rejection_reasons TEXT,
        review_notes TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT,
        payout_method TEXT,
        payout_reference TEXT,
        payout_completed_at TEXT,
        linked_sale_id TEXT,
        linked_repair_id TEXT,
        device_inventory_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        shop_id TEXT,
        processed_by TEXT,
        attachments TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS blocked_imeis (
        id TEXT PRIMARY KEY,
        imei TEXT NOT NULL UNIQUE,
        reason TEXT NOT NULL,
        blocked_at TEXT,
        blocked_by TEXT,
        notes TEXT,
        shop_id TEXT
      );

      CREATE TABLE IF NOT EXISTS trade_in_audit_logs (
        id TEXT PRIMARY KEY,
        trade_in_id TEXT NOT NULL,
        action TEXT NOT NULL,
        previous_state TEXT,
        new_state TEXT,
        user_id TEXT,
        user_name TEXT,
        ip_address TEXT,
        user_agent TEXT,
        notes TEXT,
        timestamp TEXT
      );

      CREATE TABLE IF NOT EXISTS scoring_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        min_score INTEGER NOT NULL,
        max_score INTEGER NOT NULL,
        decision TEXT NOT NULL,
        multiplier TEXT DEFAULT '1.00',
        is_active INTEGER DEFAULT 1,
        shop_id TEXT
      );

      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        source TEXT,
        notes TEXT,
        assigned_to TEXT,
        priority TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'new',
        next_follow_up_at TEXT,
        follow_up_history TEXT,
        created_by TEXT,
        created_by_name TEXT,
        shop_id TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS lead_audit_logs (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        action TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        details TEXT,
        metadata TEXT,
        timestamp TEXT
      );
      CREATE TABLE IF NOT EXISTS brands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS storage_options (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL,
        size TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT NOT NULL UNIQUE,
        shop_id TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        subtotal INTEGER DEFAULT 0,
        delivery_fee INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        payment_method TEXT NOT NULL,
        payment_status TEXT DEFAULT 'PENDING',
        channel TEXT DEFAULT 'ONLINE',
        status TEXT DEFAULT 'PENDING',
        delivery_type TEXT NOT NULL,
        delivery_address TEXT,
        assigned_staff_id TEXT,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        imei TEXT,
        quantity INTEGER DEFAULT 1,
        unit_price INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL UNIQUE,
        assigned_rider_id TEXT,
        status TEXT DEFAULT 'PENDING',
        address TEXT NOT NULL,
        scheduled_at TEXT,
        picked_up_at TEXT,
        delivered_at TEXT,
        failure_reason TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        pdf_url TEXT,
        sent_via TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        message TEXT NOT NULL,
        read INTEGER DEFAULT 0,
        created_at TEXT
      );
    `);
    const sqliteMigrations = [
      "ALTER TABLE products ADD COLUMN slug TEXT",
      "ALTER TABLE products ADD COLUMN description TEXT",
      "ALTER TABLE products ADD COLUMN condition TEXT DEFAULT 'New'",
      "ALTER TABLE products ADD COLUMN ram TEXT",
      "ALTER TABLE products ADD COLUMN storage TEXT",
      "ALTER TABLE products ADD COLUMN specs TEXT",
      "ALTER TABLE products ADD COLUMN featured INTEGER DEFAULT 0",
      "ALTER TABLE products ADD COLUMN is_published INTEGER DEFAULT 1",
      "ALTER TABLE products ADD COLUMN is_flash_deal INTEGER DEFAULT 0",
      "ALTER TABLE products ADD COLUMN flash_deal_price INTEGER",
      "ALTER TABLE products ADD COLUMN flash_deal_ends_at TEXT",
      "ALTER TABLE products ADD COLUMN popularity INTEGER DEFAULT 0",
    ];
    for (const statement of sqliteMigrations) {
      try {
        sqlite.exec(statement);
      } catch {}
    }
  } catch (err) {
    // ignore schema creation errors
  }
  _db = drizzleSqlite(sqlite);
}

export const db = _db;
