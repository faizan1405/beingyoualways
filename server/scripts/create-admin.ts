// Creates the first (owner) admin account from the server console. There is no public sign-up.
// Usage: npm run admin:create -- --email owner@example.com --name "Store Owner"
//   Password: typed at the prompt, or ADMIN_PASSWORD env var for non-interactive setups (unset it afterwards).
//   Additional accounts: add --role admin|staff --allow-additional
import { createPrisma } from "../src/db.js";
import { HttpError } from "../src/errors.js";
import type { RoleKey } from "../src/lib/permissions.js";
import { createAdminUser } from "../src/services/authService.js";
import { argValue, askHidden } from "./prompt.js";

const url = process.env["DATABASE_URL"];
const email = argValue("email");
const name = argValue("name");
if (!url || !email || !name) { console.error('Usage: DATABASE_URL=... npm run admin:create -- --email you@example.com --name "Your Name"'); process.exit(1); }
const password = process.env["ADMIN_PASSWORD"] ?? (await askHidden("New admin password (min 12 characters): "));
if (!process.env["ADMIN_PASSWORD"] && (await askHidden("Repeat password: ")) !== password) { console.error("Passwords don't match."); process.exit(1); }
const prisma = createPrisma(url);
try {
  const u = await createAdminUser(prisma, { email, name, password, role: (argValue("role") ?? "owner") as RoleKey }, { allowAdditional: process.argv.includes("--allow-additional") });
  console.log(`Admin account created for ${u.email}.`);
} catch (e) {
  console.error(e instanceof HttpError ? e.message : "Could not create the admin account.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
