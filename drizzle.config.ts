import { defineConfig } from "drizzle-kit";

// Generates SQL migrations into ./drizzle; wrangler applies them to D1
// (`npm run db:migrate:local` / `npm run db:migrate:remote`).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
