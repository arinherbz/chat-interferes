import { pbkdf2Sync, randomBytes } from "crypto";
import { storage } from "../server/storage";

const hashIterations = 120000;

function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(secret, salt, hashIterations, 64, "sha512").toString("hex");
  return `pbkdf2:${hashIterations}:${salt}:${derived}`;
}

async function main() {
  const existingUsers = await storage.listUsers();

  const owner = existingUsers.find((u) => u.role === "Owner");
  if (!owner) {
    const created = await storage.createUser({
      username: "owner",
      password: hashSecret("0000"),
      name: "Shop Owner",
      email: "owner@ariostore.local",
      role: "Owner",
      status: "active",
      shopId: null,
    });
    try {
      await storage.createActivityLog({
        action: "seed",
        entity: "user",
        entityId: created.id,
        userId: created.id,
        userName: created.name || "Owner",
        role: created.role,
        details: "Default owner account created (username: owner, PIN: 0000). Please change immediately.",
        metadata: {},
      });
    } catch {
      console.warn("Activity log table not ready during seed. Proceeding.");
    }
    console.log("Seeded default owner account (owner / 0000). Change the PIN in staff settings.");
  }

  const staffUser = existingUsers.find((u) => u.username === "staff");
  if (!staffUser) {
    const staff = await storage.createUser({
      username: "staff",
      password: hashSecret("1111"),
      name: "Default Staff",
      email: "staff@ariostore.local",
      role: "Sales",
      status: "active",
      shopId: null,
    });
    try {
      await storage.createActivityLog({
        action: "seed",
        entity: "user",
        entityId: staff.id,
        userId: staff.id,
        userName: staff.name || "Staff",
        role: staff.role,
        details: "Default staff account created (username: staff, PIN: 1111). Please change immediately.",
        metadata: {},
      });
    } catch {
      console.warn("Activity log table not ready during staff seed. Proceeding.");
    }
    console.log("Seeded default staff account (staff / 1111). Change the PIN in staff settings.");
  }

  if (owner && staffUser) {
    console.log("Owner and staff accounts already exist.");
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
