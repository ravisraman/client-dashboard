"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { env } from "@/lib/env";
import { createPortalSession, findCustomerId } from "@/lib/stripe";

export async function openBillingPortalAction() {
  const user = await requireUser();
  if (!env.stripeEnabled()) redirect("/dashboard");
  const customerId = await findCustomerId(user);
  if (!customerId) redirect("/dashboard?billing=missing");
  const url = await createPortalSession(customerId, `${env.appUrl()}/dashboard`);
  redirect(url);
}
