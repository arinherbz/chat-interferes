import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error(
    "drizzle-kit push requires a Postgres DATABASE_URL. For local SQLite fallback, skip `npm run db:push` and run `npm run dev`.",
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
