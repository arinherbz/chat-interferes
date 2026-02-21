import { storage } from "../server/storage";
import { DEFAULT_BASE_VALUES } from "../server/trade-in-scoring";

async function main() {
  const existing = await storage.getDeviceBaseValues();
  if (existing.length > 0) {
    console.log(`Base values already seeded (${existing.length})`);
    return;
  }

  for (const v of DEFAULT_BASE_VALUES) {
    await storage.upsertDeviceBaseValue({ ...v, isActive: true, shopId: null });
  }

  const after = await storage.getDeviceBaseValues();
  console.log(`Seeded base values (${after.length})`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
