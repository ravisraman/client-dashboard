import "server-only";
import Stripe from "stripe";
import { env } from "./env";

let client: Stripe | undefined;

export function stripe() {
  client ??= new Stripe(env.stripeSecretKey());
  return client;
}

/** The client's Stripe customer: the pinned id if the admin set one, otherwise matched by email. */
export async function findCustomerId(user: { email: string; stripeCustomerId: string | null }) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const { data } = await stripe().customers.list({ email: user.email, limit: 1 });
  return data[0]?.id ?? null;
}

export type BillingSummary = {
  subscriptions: {
    id: string;
    status: string;
    product: string;
    amount: string | null;
    renewsOn: number | null;
    cancelAtPeriodEnd: boolean;
  }[];
  invoices: {
    id: string;
    number: string | null;
    created: number;
    total: string;
    status: string | null;
    url: string | null;
  }[];
};

function money(amount: number | null | undefined, currency: string) {
  if (amount == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
}

export async function getBillingSummary(customerId: string): Promise<BillingSummary> {
  const [subs, invoices] = await Promise.all([
    stripe().subscriptions.list({ customer: customerId, status: "all", limit: 10, expand: ["data.items.data.price.product"] }),
    stripe().invoices.list({ customer: customerId, limit: 6 }),
  ]);

  return {
    subscriptions: subs.data
      .filter((s) => s.status !== "incomplete_expired")
      .map((s) => {
        const item = s.items.data[0];
        const price = item?.price;
        const product = price?.product;
        const interval = price?.recurring ? ` / ${price.recurring.interval}` : "";
        const amount = money(price?.unit_amount, price?.currency ?? "usd");
        return {
          id: s.id,
          status: s.status,
          product:
            typeof product === "object" && product && "name" in product ? product.name : (price?.nickname ?? "Subscription"),
          amount: amount ? `${amount}${interval}` : null,
          renewsOn: item?.current_period_end ?? null,
          cancelAtPeriodEnd: s.cancel_at_period_end,
        };
      }),
    invoices: invoices.data
      .filter((i) => i.status !== "draft")
      .map((i) => ({
        id: i.id ?? "",
        number: i.number,
        created: i.created,
        total: money(i.total, i.currency) ?? "",
        status: i.status,
        url: i.hosted_invoice_url ?? null,
      })),
  };
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  const session = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}
