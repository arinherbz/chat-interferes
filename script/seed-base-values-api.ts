import { DEFAULT_BASE_VALUES } from "../server/trade-in-scoring";

const API_URL = process.env.API_URL || "http://127.0.0.1:5000";

async function seed() {
  let added = 0;
  for (const v of DEFAULT_BASE_VALUES) {
    try {
      const res = await fetch(`${API_URL}/api/trade-in/base-values/manage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: v.brand,
          model: v.model,
          storage: v.storage,
          baseValue: v.baseValue,
          isActive: true,
          shopId: v.shopId ?? null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`Failed ${v.brand} ${v.model} ${v.storage}: ${res.status} ${text}`);
        continue;
      }
      added += 1;
    } catch (err) {
      console.error(`Error ${v.brand} ${v.model} ${v.storage}:`, err);
    }
  }
  console.log(`Seed via API complete. Attempted ${DEFAULT_BASE_VALUES.length}, succeeded ${added}.`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
