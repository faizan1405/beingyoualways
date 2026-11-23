// Usage (from the server folder): npm run db:seed:prod   (after npm run build)
// Safe to run more than once — never duplicates or overwrites products.
import { readFileSync } from "node:fs";
import path from "node:path";

import { createPrisma } from "../src/db.js";
import { seedDatabase, type SeedCatalogue } from "../src/services/seed.js";

const url = process.env["DATABASE_URL"];
if (!url) { console.error("DATABASE_URL is not set."); process.exit(1); }
const file = path.resolve(process.cwd(), "prisma/seed/catalogue.json");
const catalogue = JSON.parse(readFileSync(file, "utf8")) as SeedCatalogue;
const prisma = createPrisma(url);
try {
  const r = await seedDatabase(prisma, catalogue);
  console.log(`Seed complete: ${r.permissions} permissions, ${r.roles} roles, ${r.categories} categories, ${r.productsCreated} products created, ${r.productsSkipped.length} already present.`);
} catch (e) {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
