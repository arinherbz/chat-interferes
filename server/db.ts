import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;

import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";

let _db: any;
export let pool: pkg.Pool | undefined;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  _db = drizzlePostgres(pool);
} else {
  // Ensure data directory exists
  const dataDir = path.resolve(process.cwd(), ".data");
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
  const sqlitePath = path.join(dataDir, "dev.sqlite");
  const sqlite = new Database(sqlitePath);
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
    `);
  } catch (err) {
    // ignore schema creation errors
  }
  _db = drizzleSqlite(sqlite);
}

export const db = _db;
