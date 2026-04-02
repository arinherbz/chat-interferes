import { Pool } from "pg";

const databaseUrl = process.env.TARGET_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!databaseUrl || !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error("TARGET_DATABASE_URL or DATABASE_URL must point to PostgreSQL");
}

const applyChanges = process.argv.includes("--apply");
const pool = new Pool({ connectionString: databaseUrl });

const obviousTestPatterns = [
  "barcode product%",
  "product with media%",
  "storefront visible %",
  "storefront hidden %",
  "account flow charger%",
  "order test charger%",
  "test cable%",
];

const normalizeWhitespace = (value?: string | null) => value?.trim().replace(/\s+/g, " ") || "";

function toTitleCase(value?: string | null) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  const specialWords: Record<string, string> = {
    iphone: "iPhone",
    ipad: "iPad",
    macbook: "MacBook",
    airpods: "AirPods",
    usbc: "USB-C",
    "usb-c": "USB-C",
    jbl: "JBL",
    hp: "HP",
    asus: "ASUS",
  };

  return normalized
    .split(" ")
    .map((part) => {
      const lower = part.toLowerCase();
      if (specialWords[lower]) return specialWords[lower];
      if (/^\d+(gb|tb|w)$/i.test(part)) return part.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

async function main() {
  const client = await pool.connect();
  try {
    const obviousTestWhere = obviousTestPatterns
      .map((_, index) => `name ILIKE $${index + 1}`)
      .join(" OR ");

    const obviousTestRows = await client.query(
      `
        SELECT id, name, storefront_visibility
        FROM products
        WHERE ${obviousTestWhere}
        ORDER BY created_at DESC
      `,
      obviousTestPatterns,
    );

    const probablyPlaceholderRows = await client.query(
      `
        SELECT id, name, category, storefront_visibility
        FROM products
        WHERE COALESCE(TRIM(name), '') = COALESCE(TRIM(category), '')
          AND COALESCE(TRIM(brand), '') = ''
          AND COALESCE(TRIM(model), '') = ''
          AND storefront_visibility = 'published'
      `,
    );

    const realCatalogRows = await client.query(
      `
        SELECT id, name, brand, model, category, display_title
        FROM products
        WHERE storefront_visibility = 'published'
          AND NOT (${obviousTestWhere})
        ORDER BY created_at DESC
      `,
      obviousTestPatterns,
    );

    console.log(`Obvious test/demo rows: ${obviousTestRows.rowCount}`);
    console.log(`Placeholder rows with customer-unfriendly names: ${probablyPlaceholderRows.rowCount}`);
    console.log(`Published non-test rows to normalize: ${realCatalogRows.rowCount}`);

    if (!applyChanges) {
      console.log("Dry run only. Re-run with --apply to archive test/demo rows and normalize live products.");
      return;
    }

    await client.query("BEGIN");

    if (obviousTestRows.rowCount) {
      await client.query(
        `
          UPDATE products
          SET storefront_visibility = 'archived',
              is_featured = FALSE,
              is_flash_deal = FALSE,
              flash_deal_price = NULL,
              flash_deal_ends_at = NULL,
              updated_at = NOW()
          WHERE ${obviousTestWhere}
        `,
        obviousTestPatterns,
      );
    }

    if (probablyPlaceholderRows.rowCount) {
      const placeholderIds = probablyPlaceholderRows.rows.map((row) => row.id);
      await client.query(
        `
          UPDATE products
          SET storefront_visibility = 'archived',
              is_featured = FALSE,
              is_flash_deal = FALSE,
              flash_deal_price = NULL,
              flash_deal_ends_at = NULL,
              updated_at = NOW()
          WHERE id = ANY($1::varchar[])
        `,
        [placeholderIds],
      );
    }

    for (const row of realCatalogRows.rows) {
      const normalizedName = toTitleCase(row.name);
      const normalizedBrand = toTitleCase(row.brand);
      const normalizedModel = toTitleCase(row.model);
      const normalizedCategory = toTitleCase(row.category);
      const normalizedDisplayTitle = row.display_title ? toTitleCase(row.display_title) : null;

      await client.query(
        `
          UPDATE products
          SET name = $2,
              brand = NULLIF($3, ''),
              model = NULLIF($4, ''),
              category = NULLIF($5, ''),
              display_title = $6,
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          row.id,
          normalizedName || row.name,
          normalizedBrand,
          normalizedModel,
          normalizedCategory,
          normalizedDisplayTitle,
        ],
      );
    }

    await client.query("COMMIT");
    console.log("Catalog cleanup applied successfully.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
