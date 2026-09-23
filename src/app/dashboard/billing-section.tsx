import type { User } from "@/db/schema";
import { findCustomerId, getBillingSummary, type BillingSummary } from "@/lib/stripe";
import { openBillingPortalAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment past due",
  unpaid: "Unpaid",
  canceled: "Cancelled",
  incomplete: "Incomplete",
  paused: "Paused",
  paid: "Paid",
  open: "Due",
  void: "Void",
  uncollectible: "Uncollectible",
};

function date(unix: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(unix * 1000));
}

export async function BillingSection({ user, missing }: { user: User; missing: boolean }) {
  let summary: BillingSummary | null = null;
  let failed = false;
  try {
    const customerId = await findCustomerId(user);
    if (customerId) summary = await getBillingSummary(customerId);
  } catch (e) {
    console.error(e);
    failed = true;
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">Payments &amp; subscription</h2>
        {summary && (
          <form action={openBillingPortalAction}>
            <button className="btn-primary">Manage billing</button>
          </form>
        )}
      </div>

      {failed ? (
        <p className="mt-3 text-sm text-accent">We couldn&apos;t load your billing details right now.</p>
      ) : !summary || missing ? (
        <p className="mt-3 text-sm text-ink-soft">
          We couldn&apos;t find billing details for {user.email}. Please contact your coach if you think this is a mistake.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            Use <strong>Manage billing</strong> to update your card, download receipts, or change your subscription securely on
            Stripe.
          </p>
          {summary.subscriptions.length > 0 && (
            <ul className="mt-4 space-y-2">
              {summary.subscriptions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 bg-paper-alt p-3 text-sm">
                  <div>
                    <p className="font-medium">{s.product}</p>
                    {s.amount && <p className="text-ink-soft">{s.amount}</p>}
                  </div>
                  <div className="text-right">
                    <span className="bg-paper px-2 py-0.5 text-xs font-medium ring-1 ring-rule-strong">
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    {s.renewsOn && s.status !== "canceled" && (
                      <p className="mt-1 text-xs text-ink-soft">
                        {s.cancelAtPeriodEnd ? "Ends" : "Renews"} {date(s.renewsOn)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {summary.invoices.length > 0 && (
            <>
              <h3 className="eyebrow mt-6">Recent invoices</h3>
              <ul className="mt-2 divide-y divide-rule text-sm">
                {summary.invoices.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                    <span>{date(i.created)}</span>
                    <span className="text-ink-soft">{i.total}</span>
                    <span className="text-xs text-ink-soft">{STATUS_LABEL[i.status ?? ""] ?? i.status}</span>
                    {i.url ? (
                      <a href={i.url} target="_blank" rel="noopener noreferrer" className="link">
                        View
                      </a>
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
