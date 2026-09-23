import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type DB = ReturnType<typeof drizzle<typeof schema>>;

const cache = new WeakMap<D1Database, DB>();

/** Drizzle client for the D1 binding `DB` (local emulator under `next dev`, real D1 when deployed). */
export function getDb(): DB {
  const binding = getCloudflareContext().env.DB;
  let db = cache.get(binding);
  if (!db) {
    db = drizzle(binding, { schema });
    cache.set(binding, db);
  }
  return db;
}
