"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { cancelBooking, getBooking, rescheduleBooking, CalApiError } from "@/lib/calcom";
import { changeBlockedReason, findAttendee } from "@/lib/bookings";
import { getClientEmails } from "@/lib/client-emails";
import { env } from "@/lib/env";
import { createPortalSession, findCustomerId } from "@/lib/stripe";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Loads a booking and confirms the signed-in client is an attendee who may still change it. */
async function loadOwnedChangeableBooking(uid: string) {
  const user = await requireUser();
  const booking = await getBooking(uid);
  // Admins may act on any booking; clients only on bookings made with one of their emails.
  const attendee = findAttendee(booking, await getClientEmails(user));
  if (user.role !== "admin" && !attendee) {
    throw new CalApiError("Booking not found", 404);
  }
  const blocked = user.role === "admin" ? null : changeBlockedReason(booking, new Date(), env.changeCutoffHours());
  return { user, booking, blocked, attendeeEmail: attendee?.email ?? user.email };
}

function toError(e: unknown): ActionResult {
  if (e instanceof CalApiError) return { ok: false, error: e.status === 404 ? "Booking not found." : e.message };
  console.error(e);
  return { ok: false, error: "Something went wrong. Please try again or contact your coach." };
}

const cancelSchema = z.object({ uid: z.string().min(1).max(200), reason: z.string().trim().max(500).optional() });

export async function cancelBookingAction(input: { uid: string; reason?: string }): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const { user, blocked } = await loadOwnedChangeableBooking(parsed.data.uid);
    if (blocked) return { ok: false, error: blocked };
    await cancelBooking(parsed.data.uid, parsed.data.reason || `Cancelled by ${user.name || user.email} via client portal`);
  } catch (e) {
    return toError(e);
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

const rescheduleSchema = z.object({
  uid: z.string().min(1).max(200),
  start: z.iso.datetime({ offset: true }),
  reason: z.string().trim().max(500).optional(),
});

export async function rescheduleBookingAction(input: { uid: string; start: string; reason?: string }): Promise<ActionResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  if (Date.parse(parsed.data.start) <= Date.now()) return { ok: false, error: "Please pick a time in the future." };
  try {
    const { blocked, attendeeEmail } = await loadOwnedChangeableBooking(parsed.data.uid);
    if (blocked) return { ok: false, error: blocked };
    await rescheduleBooking(
      parsed.data.uid,
      new Date(parsed.data.start).toISOString(),
      parsed.data.reason || "Rescheduled via client portal",
      attendeeEmail,
    );
  } catch (e) {
    return toError(e);
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function openBillingPortalAction() {
  const user = await requireUser();
  if (!env.stripeEnabled()) redirect("/dashboard");
  const customerId = await findCustomerId(user);
  if (!customerId) redirect("/dashboard?billing=missing");
  const url = await createPortalSession(customerId, `${env.appUrl()}/dashboard`);
  redirect(url);
}
