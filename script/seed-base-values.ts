import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { deviceBaseValues } from "@shared/schema";
import { DEFAULT_BASE_VALUES } from "../server/trade-in-scoring";

async function main() {
  const [{ count: beforeCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deviceBaseValues);

  await db
    .insert(deviceBaseValues)
    .values(
      DEFAULT_BASE_VALUES.map((v) => ({
        ...v,
        isActive: true,
      })),
    )
    .onConflictDoNothing({
      target: [deviceBaseValues.brand, deviceBaseValues.model, deviceBaseValues.storage],
    });

  const [{ count: afterCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deviceBaseValues);

  console.log(
    `Seed complete. Existing: ${beforeCount}, now: ${afterCount}, added: ${
      (afterCount as number) - (beforeCount as number)
    }.`,
  );
}

main().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
