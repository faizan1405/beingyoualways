// Usage (in the server folder, after npm run build):
//   npm run deploy:check                                   config, database, migrations, media, stamps
//   npm run deploy:check -- --api-url https://api-staging.beingyoualways.com   + the live address from outside
//   npm run deploy:check -- --api-url https://… --providers                     + read-only Razorpay/Google/Meta/SMTP calls
// Exits with 1 when anything needs fixing. Never prints secrets.
import { formatChecks, runPreflight } from "../src/services/preflight.js";

const args = process.argv.slice(2);
const at = args.indexOf("--api-url");
const apiUrl = at >= 0 ? args[at + 1] : undefined;
if (at >= 0 && (!apiUrl || !/^https?:\/\/[^\s/]+\/?$/.test(apiUrl))) {
  console.error("--api-url needs the API's address, e.g. https://api-staging.beingyoualways.com");
  process.exit(2);
}
const checks = await runPreflight({ env: process.env, cwd: process.cwd(), apiUrl, providers: args.includes("--providers") });
console.log(formatChecks(checks));
process.exitCode = checks.some((c) => c.status === "fail") ? 1 : 0;
