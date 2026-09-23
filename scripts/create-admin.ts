/**
 * Creates (or promotes) an admin account in D1.
 *
 *   npm run admin:create -- you@example.com "Your Name"            # local dev database
 *   npm run admin:create -- you@example.com "Your Name" --remote   # production D1
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const [emailArg, ...nameParts] = args.filter((a) => a !== "--remote");
const email = emailArg?.trim().toLowerCase();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run admin:create -- <email> "<name>" [--remote]');
  process.exit(1);
}

const name = nameParts.join(" ").trim() || email.split("@")[0];
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const now = Math.floor(Date.now() / 1000);

const sql = `INSERT INTO user (id, name, email, email_verified, created_at, updated_at, role)
VALUES (${q(randomUUID())}, ${q(name)}, ${q(email)}, 0, ${now}, ${now}, 'admin')
ON CONFLICT(email) DO UPDATE SET role = 'admin', updated_at = ${now};`;

execFileSync("npx", ["wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", "--command", sql], { stdio: "inherit" });
console.log(`\n✔ ${email} is an admin${remote ? " (production)" : " (local)"}.`);
