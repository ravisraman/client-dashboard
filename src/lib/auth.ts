import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { getDb, type DB } from "@/db";
import * as schema from "@/db/schema";
import { sendMagicLinkEmail } from "./email";

function createAuth(db: DB) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh daily while in use
    },
    user: {
      additionalFields: {
        // input: false => these can never be set by the client through auth endpoints.
        role: { type: "string", required: false, defaultValue: "client", input: false },
        programStart: { type: "string", required: false, input: false },
        programEnd: { type: "string", required: false, input: false },
        programName: { type: "string", required: false, input: false },
        stripeCustomerId: { type: "string", required: false, input: false },
      },
    },
    rateLimit: { enabled: true, storage: "database" },
    plugins: [
      magicLink({
        expiresIn: 60 * 15,
        // Only people the admin has added as clients (or admins) can sign in.
        disableSignUp: true,
        storeToken: "hashed",
        rateLimit: { window: 60, max: 3 },
        sendMagicLink: async ({ email, url }) => {
          const existing = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(eq(schema.user.email, email.toLowerCase()))
            .get();
          // Silently skip unknown addresses so the form doesn't reveal who is a client.
          if (!existing) return;
          await sendMagicLinkEmail(email, url);
        },
      }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
const instances = new WeakMap<DB, Auth>();

/** Better Auth instance bound to the current D1 database. */
export function getAuth(): Auth {
  const db = getDb();
  let auth = instances.get(db);
  if (!auth) {
    auth = createAuth(db);
    instances.set(db, auth);
  }
  return auth;
}
