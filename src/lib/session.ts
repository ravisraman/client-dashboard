import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { getAuth } from "./auth";
import { getDb } from "@/db";
import { user } from "@/db/schema";

/** Current signed-in user, re-read from the database so role/program changes apply immediately. */
export const getCurrentUser = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  return (await getDb().select().from(user).where(eq(user.id, session.user.id)).get()) ?? null;
});

export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  return current;
}

export async function requireAdmin() {
  const current = await requireUser();
  if (current.role !== "admin") redirect("/dashboard");
  return current;
}
