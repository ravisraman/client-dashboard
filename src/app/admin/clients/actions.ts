"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { session, user } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export type ClientFormValues = Partial<
  Record<"name" | "email" | "programName" | "programStart" | "programEnd" | "stripeCustomerId", string>
>;
// On error the submitted values are returned so the form can be re-filled (React resets forms after an action).
export type FormState = { error?: string; ok?: boolean; values?: ClientFormValues } | undefined;

const optionalDate = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD")
      .nullable(),
  );

const clientSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    email: z.email("Enter a valid email").trim().toLowerCase().max(320),
    programName: z
      .string()
      .trim()
      .max(200)
      .transform((v) => v || null),
    programStart: optionalDate,
    programEnd: optionalDate,
    stripeCustomerId: z
      .string()
      .trim()
      .transform((v) => v || null)
      .pipe(
        z
          .string()
          .regex(/^cus_[A-Za-z0-9]+$/, "Stripe customer IDs look like cus_…")
          .nullable(),
      ),
  })
  .refine((v) => !v.programStart || !v.programEnd || v.programStart <= v.programEnd, {
    message: "Program end date must be on or after the start date",
  });

function readValues(formData: FormData): ClientFormValues {
  const get = (k: string) => String(formData.get(k) ?? "");
  return {
    name: get("name"),
    email: get("email"),
    programName: get("programName"),
    programStart: get("programStart"),
    programEnd: get("programEnd"),
    stripeCustomerId: get("stripeCustomerId"),
  };
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const values = readValues(formData);
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const db = getDb();
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, parsed.data.email)).get();
  if (existing) return { error: "A client with that email already exists.", values };

  const now = new Date();
  await db.insert(user).values({
    id: crypto.randomUUID(),
    ...parsed.data,
    role: "client",
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function updateClientAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const values = readValues(formData);
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const db = getDb();
  const clash = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.email, parsed.data.email), ne(user.id, id)))
    .get();
  if (clash) return { error: "Another account already uses that email.", values };

  const current = await db
    .select()
    .from(user)
    .where(and(eq(user.id, id), eq(user.role, "client")))
    .get();
  if (!current) return { error: "Client not found.", values };

  await db
    .update(user)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(user.id, id));
  // If the login email changed, sign the client out everywhere.
  if (current.email !== parsed.data.email) await db.delete(session).where(eq(session.userId, id));
  revalidatePath("/admin", "layout");
  return { ok: true, values };
}

export async function deleteClientAction(id: string) {
  await requireAdmin();
  // Only client accounts can be removed here (never admins); sessions cascade.
  await getDb()
    .delete(user)
    .where(and(eq(user.id, id), eq(user.role, "client")));
  revalidatePath("/admin", "layout");
  redirect("/admin/clients");
}
