import { storage } from "../server/storage";
import { db } from "../server/db";
import fs from "fs";
import path from "path";

async function main() {
  // quick DB health check
  try {
    if (typeof (db as any).execute === "function") {
      await (db as any).execute("select 1");
    }
  } catch (err) {
    console.error("DB connection failed:", err);
    process.exit(1);
  }

  // If no DATABASE_URL, use direct sqlite operations to avoid Postgres-specific SQL
  if (!process.env.DATABASE_URL) {
    try {
      const { default: Database } = await import("better-sqlite3");
      const dataDir = path.resolve(process.cwd(), ".data");
      try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
      const sqlitePath = path.join(dataDir, "dev.sqlite");
      const sqlite = new Database(sqlitePath);

      // ensure schema
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS shops (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT UNIQUE,
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
      `);

      const row = sqlite.prepare("SELECT * FROM shops WHERE slug = ? OR LOWER(name) LIKE ? LIMIT 1").get("kampala-main", "%kampala%");
      if (row) {
        console.log("Kampala shop already exists:", row.id);
        sqlite.prepare("UPDATE shops SET name = ?, slug = ?, is_main = ? WHERE id = ?").run("Kampala Main", "kampala-main", 1, row.id);
        console.log("Updated shop:", row.id);
        sqlite.close();
        process.exit(0);
      }

      const id = (globalThis as any).crypto?.randomUUID?.() || `shop-${Date.now()}`;
      const now = new Date().toISOString();
      sqlite.prepare(`INSERT INTO shops (id,name,slug,description,address,phone,email,timezone,is_main,currency,subscription_plan,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, "Kampala Main", "kampala-main", "Main Kampala store", "Kampala Road", "+256 700 000000", "kampala@store.local", "Africa/Kampala", 1, "UGX", "pro", now, now
      );
      console.log("Created shop:", id);
      sqlite.close();
      process.exit(0);
    } catch (err) {
      console.error("SQLite seeding failed:", err);
      process.exit(1);
    }
  }

  // Postgres path using storage
  const shops = await storage.getShops();
  const existing = shops.find(s => s.slug === "kampala-main" || s.name?.toLowerCase().includes("kampala"));
  if (existing) {
    console.log("Kampala shop already exists:", existing.id);
    // ensure it's marked main
    const updated = await storage.updateShop(existing.id, { name: "Kampala Main", slug: "kampala-main", isMain: true });
    console.log("Updated shop:", updated?.id);
    process.exit(0);
  }

  const created = await storage.createShop({
    id: (globalThis as any).crypto?.randomUUID?.() || `shop-${Date.now()}`,
    name: "Kampala Main",
    slug: "kampala-main",
    description: "Main Kampala store",
    address: "Kampala Road",
    phone: "+256 700 000000",
    email: "kampala@store.local",
    timezone: "Africa/Kampala",
    isMain: true,
    currency: "UGX",
    subscriptionPlan: "pro",
    createdAt: new Date() as any,
    updatedAt: new Date() as any,
  } as any);

  console.log("Created shop:", created.id);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
