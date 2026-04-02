import pkg from "pg";
import { randomUUID } from "crypto";
import { getConditionQuestionsForDeviceType } from "../server/trade-in-scoring";
import type { TradeInDeviceType } from "../shared/trade-in-profile";

const { Pool } = pkg;

const connectionString = process.argv[2];

if (!connectionString) {
  console.error("Usage: ./node_modules/.bin/tsx script/seed-condition-profiles.ts <postgres-connection-string>");
  process.exit(1);
}

const DEVICE_TYPES: TradeInDeviceType[] = ["phone", "tablet", "laptop", "other"];

async function main() {
  const pool = new Pool({ connectionString });

  try {
    await pool.query(`
      ALTER TABLE condition_questions
        ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'phone';
      ALTER TABLE condition_questions
        ADD COLUMN IF NOT EXISTS shop_id VARCHAR;
      UPDATE condition_questions
        SET device_type = 'phone'
        WHERE device_type IS NULL OR trim(device_type) = '';
    `);

    for (const deviceType of DEVICE_TYPES) {
      const existing = await pool.query(
        `SELECT COUNT(*)::int AS count FROM condition_questions WHERE device_type = $1 AND shop_id IS NULL`,
        [deviceType],
      );
      const count = Number(existing.rows[0]?.count ?? 0);

      if (count > 0) {
        console.log(`[seed-condition-profiles] ${deviceType}: already has ${count} global questions`);
        continue;
      }

      const defaults = getConditionQuestionsForDeviceType(deviceType);
      for (const question of defaults) {
        await pool.query(
          `INSERT INTO condition_questions
            (id, device_type, category, question, options, sort_order, is_required, is_critical, is_active, shop_id)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, NULL)`,
          [
            randomUUID(),
            deviceType,
            question.category,
            question.question,
            JSON.stringify(question.options),
            question.sortOrder ?? 0,
            question.isRequired ?? true,
            question.isCritical ?? false,
            true,
          ],
        );
      }

      console.log(`[seed-condition-profiles] ${deviceType}: inserted ${defaults.length} default questions`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[seed-condition-profiles] failed", error);
  process.exit(1);
});
