// Account recovery from the server console: sets a new password and signs the account out everywhere.
// Usage: npm run admin:reset-password -- --email owner@example.com
import { createPrisma } from "../src/db.js";
import { HttpError } from "../src/errors.js";
import { resetAdminPassword } from "../src/services/authService.js";
import { argValue, askHidden } from "./prompt.js";

const url = process.env["DATABASE_URL"];
const email = argValue("email");
if (!url || !email) { console.error("Usage: DATABASE_URL=... npm run admin:reset-password -- --email you@example.com"); process.exit(1); }
const password = process.env["ADMIN_PASSWORD"] ?? (await askHidden("New password (min 12 characters): "));
const prisma = createPrisma(url);
try {
  await resetAdminPassword(prisma, email, password);
  console.log("Password changed. All existing sessions for this account were signed out.");
} catch (e) {
  console.error(e instanceof HttpError ? e.message : "Could not reset the password.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
