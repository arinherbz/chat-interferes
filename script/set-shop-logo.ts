import { storage } from "../server/storage";
import { db } from "../server/db";

const argv = process.argv.slice(2);
if (argv.length < 2) {
  console.error("Usage: tsx script/set-shop-logo.ts <shopId> <logoUrl>");
  process.exit(1);
}
const [shopId, logoUrl] = argv;

async function main() {
  try {
    await db.execute("select 1");
  } catch (err) {
    console.error("DB connection failed:", err);
    process.exit(1);
  }
  const updated = await storage.updateShop(shopId, { logo: { url: logoUrl, uploadedAt: new Date().toISOString() } } as any);
  console.log("Updated shop:", updated?.id, updated?.logo);
}

main().catch(err => { console.error(err); process.exit(1); });
