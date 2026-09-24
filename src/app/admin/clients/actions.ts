"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { bookingEmail, session, user } from "@/db/schema";
import { requireAdmin } from "@/lib/session";

export type ClientFormValues = Partial<
  Record<"name" | "email" | "bookingEmails" | "programName" | "programStart" | "programEnd" | "stripeCustomerId", string>
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
    // One per line (or comma-separated). Bookings under these count as the client's; they can't sign in.
    bookingEmails: z
      .string()
      .transform((v) => [
        ...new Set(
          v
            .split(/[\s,;]+/)
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
        ),
      ])
      .pipe(z.array(z.email("One of the other booking emails isn't a valid email").max(320)).max(20, "Up to 20 other emails")),
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
    bookingEmails: get("bookingEmails"),
    programName: get("programName"),
    programStart: get("programStart"),
    programEnd: get("programEnd"),
    stripeCustomerId: get("stripeCustomerId"),
  };
}

type Db = ReturnType<typeof getDb>;

/** Returns an error message if any address already belongs to a different account. */
async function findEmailConflict(db: Db, clientId: string | null, signIn: string, extras: string[]) {
  const all = [signIn, ...extras];
  const owners = await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.email, all)).all();
  const takenLogin = owners.find((o) => o.id !== clientId);
  if (takenLogin) return `${takenLogin.email} is already another account's sign-in email.`;
  const extraOwners = await db
    .select({ userId: bookingEmail.userId, email: bookingEmail.email })
    .from(bookingEmail)
    .where(inArray(bookingEmail.email, all))
    .all();
  const takenExtra = extraOwners.find((o) => o.userId !== clientId);
  if (takenExtra) return `${takenExtra.email} is already a booking email for another client.`;
  return null;
}

/** Replaces the client's extra booking emails (sign-in email excluded). */
function replaceBookingEmails(db: Db, userId: string, extras: string[]) {
  const now = new Date();
  return [
    db.delete(bookingEmail).where(eq(bookingEmail.userId, userId)),
    ...extras.map((email) => db.insert(bookingEmail).values({ id: crypto.randomUUID(), userId, email, createdAt: now })),
  ] as const;
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const values = readValues(formData);
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const db = getDb();
  const { bookingEmails, ...fields } = parsed.data;
  const extras = bookingEmails.filter((e) => e !== fields.email);
  const conflict = await findEmailConflict(db, null, fields.email, extras);
  if (conflict) return { error: conflict, values };

  const now = new Date();
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(user).values({ id, ...fields, role: "client", emailVerified: false, createdAt: now, updatedAt: now }),
    ...replaceBookingEmails(db, id, extras),
  ]);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function updateClientAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const values = readValues(formData);
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const db = getDb();
  const current = await db
    .select()
    .from(user)
    .where(and(eq(user.id, id), eq(user.role, "client")))
    .get();
  if (!current) return { error: "Client not found.", values };

  const { bookingEmails, ...fields } = parsed.data;
  const emailChanged = current.email !== fields.email;
  // Keep the old sign-in email as a booking email so past sessions stay with this client.
  const extras = [...new Set([...bookingEmails, ...(emailChanged ? [current.email] : [])])].filter((e) => e !== fields.email);
  const conflict = await findEmailConflict(db, id, fields.email, extras);
  if (conflict) return { error: conflict, values };

  await db.batch([
    db
      .update(user)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(user.id, id)),
    ...replaceBookingEmails(db, id, extras),
    // A new sign-in email signs the client out everywhere.
    ...(emailChanged ? [db.delete(session).where(eq(session.userId, id))] : []),
  ]);
  revalidatePath("/admin", "layout");
  return { ok: true, values: { ...values, bookingEmails: extras.join("\n") } };
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
