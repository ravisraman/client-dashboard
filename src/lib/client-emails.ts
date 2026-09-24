import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingEmail } from "@/db/schema";

/** All emails whose Cal.com bookings belong to this client: sign-in email first, then extra booking emails. */
export async function getClientEmails(client: { id: string; email: string }): Promise<string[]> {
  const extra = await getDb()
    .select({ email: bookingEmail.email })
    .from(bookingEmail)
    .where(eq(bookingEmail.userId, client.id))
    .orderBy(asc(bookingEmail.createdAt))
    .all();
  return [client.email, ...extra.map((e) => e.email).filter((e) => e !== client.email)];
}

/** Extra booking emails for many clients at once, keyed by user id. */
export async function getExtraEmailsByUser(userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;
  const rows = await getDb()
    .select({ userId: bookingEmail.userId, email: bookingEmail.email })
    .from(bookingEmail)
    .where(inArray(bookingEmail.userId, userIds))
    .orderBy(asc(bookingEmail.createdAt))
    .all();
  for (const r of rows) map.set(r.userId, [...(map.get(r.userId) ?? []), r.email]);
  return map;
}
