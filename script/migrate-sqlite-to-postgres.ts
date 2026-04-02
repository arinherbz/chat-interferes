import Database from "better-sqlite3";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

type ColumnInfo = {
  column_name: string;
  data_type: string;
};

const sourcePath = process.env.SQLITE_PATH?.trim()
  ? path.resolve(process.cwd(), process.env.SQLITE_PATH.trim())
  : path.resolve(process.cwd(), ".data", "dev.sqlite");
const targetUrl = process.env.TARGET_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!fs.existsSync(sourcePath)) {
  throw new Error(`SQLite source not found: ${sourcePath}`);
}

if (!targetUrl || !/^postgres(?:ql)?:\/\//i.test(targetUrl)) {
  throw new Error("TARGET_DATABASE_URL or DATABASE_URL must point to PostgreSQL");
}

const sqlite = new Database(sourcePath, { readonly: true });
const pg = new Pool({ connectionString: targetUrl });

const preferredTableOrder = [
  "shops",
  "users",
  "user_preferences",
  "activity_logs",
  "brands",
  "models",
  "storage_options",
  "device_base_values",
  "products",
  "devices",
  "customers",
  "sales",
  "repairs",
  "expenses",
  "closures",
  "condition_questions",
  "blocked_imeis",
  "scoring_rules",
  "trade_in_assessments",
  "trade_in_audit_logs",
  "leads",
  "lead_audit_logs",
  "orders",
  "order_items",
  "deliveries",
  "receipts",
  "notifications",
  "user_sessions",
];
const selectedTables = (process.env.TABLES || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const conflictKeyByTable: Record<string, string[]> = {
  shops: ["slug"],
  users: ["username"],
  user_preferences: ["user_id"],
  brands: ["name"],
  devices: ["imei"],
  sales: ["sale_number"],
  repairs: ["repair_number"],
  blocked_imeis: ["imei"],
  trade_in_assessments: ["trade_in_number"],
  orders: ["order_number"],
  deliveries: ["order_id"],
  receipts: ["order_id"],
  user_sessions: ["sid"],
};

const sqliteTables = sqlite
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((row: any) => row.name as string);

function normalizeValue(value: unknown, dataType: string) {
  if (value === undefined) return null;
  if (value === null) return null;

  if (dataType === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const lower = value.trim().toLowerCase();
      if (["1", "true", "t", "yes"].includes(lower)) return true;
      if (["0", "false", "f", "no"].includes(lower)) return false;
    }
  }

  if (dataType === "json" || dataType === "jsonb") {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      try {
        return JSON.stringify(JSON.parse(trimmed));
      } catch {
        return JSON.stringify(trimmed);
      }
    }
    return JSON.stringify(value);
  }

  return value;
}

async function getPostgresColumns(tableName: string) {
  const { rows } = await pg.query<ColumnInfo>(
    `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName],
  );

  return rows;
}

async function getPrimaryKeyColumns(tableName: string) {
  const { rows } = await pg.query<{ column_name: string }>(
    `
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a
        ON a.attrelid = i.indrelid
       AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass
        AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)
    `,
    [tableName],
  );

  return rows.map((row) => row.column_name);
}

async function migrateTable(tableName: string) {
  console.log(`starting ${tableName}`);
  if (!sqliteTables.includes(tableName)) {
    console.log(`skip ${tableName}: not present in SQLite source`);
    return;
  }

  const columns = await getPostgresColumns(tableName);
  if (columns.length === 0) {
    console.log(`skip ${tableName}: not present in Postgres target`);
    return;
  }

  const sqliteRows = sqlite.prepare(`SELECT * FROM ${tableName}`).all() as Record<string, unknown>[];
  if (sqliteRows.length === 0) {
    console.log(`skip ${tableName}: no rows`);
    return;
  }

  const allowedColumns = columns
    .map((column) => column.column_name)
    .filter((name) => Object.prototype.hasOwnProperty.call(sqliteRows[0], name));

  if (allowedColumns.length === 0) {
    console.log(`skip ${tableName}: no overlapping columns`);
    return;
  }

  const typeByColumn = new Map(columns.map((column) => [column.column_name, column.data_type]));
  const primaryKey = await getPrimaryKeyColumns(tableName);
  const conflictKey = (conflictKeyByTable[tableName] || primaryKey).filter((column) => allowedColumns.includes(column));
  const placeholders = allowedColumns.map((_, index) => `$${index + 1}`).join(", ");
  const updateColumns = allowedColumns.filter((column) => !conflictKey.includes(column) && !primaryKey.includes(column));

  const conflictClause = conflictKey.length
    ? updateColumns.length
      ? ` ON CONFLICT (${conflictKey.join(", ")}) DO UPDATE SET ${updateColumns
          .map((column) => `${column} = EXCLUDED.${column}`)
          .join(", ")}`
      : ` ON CONFLICT (${conflictKey.join(", ")}) DO NOTHING`
    : "";

  const query = `
    INSERT INTO ${tableName} (${allowedColumns.join(", ")})
    VALUES (${placeholders})
    ${conflictClause}
  `;

  await pg.query("BEGIN");
  try {
    for (const row of sqliteRows) {
      const values = allowedColumns.map((column) => normalizeValue(row[column], typeByColumn.get(column) || ""));
      await pg.query(query, values);
    }
    await pg.query("COMMIT");
    console.log(`migrated ${tableName}: ${sqliteRows.length} rows`);
  } catch (error) {
    await pg.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  console.log(`source sqlite: ${sourcePath}`);
  console.log("target postgres: connected");

  const orderedTables = selectedTables.length
    ? preferredTableOrder.filter((table) => selectedTables.includes(table))
    : preferredTableOrder;

  for (const tableName of orderedTables) {
    await migrateTable(tableName);
  }

  if (!selectedTables.length) {
    const extras = sqliteTables.filter((table) => !preferredTableOrder.includes(table));
    for (const tableName of extras) {
      await migrateTable(tableName);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await pg.end();
  });
