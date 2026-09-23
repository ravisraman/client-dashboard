import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/session";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { programProgress } from "@/lib/bookings";
import { createClientAction } from "./actions";
import { ClientForm } from "./client-form";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ name?: string; email?: string }> }) {
  const admin = await requireAdmin();
  const prefill = await searchParams;
  const clients = await getDb().select().from(user).where(eq(user.role, "client")).orderBy(asc(user.name)).all();
  const now = new Date();

  return (
    <>
      <Header user={admin} />
      <main className="space-y-8 px-5 py-10 sm:px-12">
        <h1 className="text-4xl sm:text-5xl">Clients</h1>

        <section className="card">
          <h2 className="mb-1 text-2xl">Add a client</h2>
          <p className="mb-4 text-sm text-ink-soft">
            Only people added here can sign in. They sign in with a one-time link emailed to this address, so use the same email
            they book with on Cal.com.
          </p>
          <ClientForm
            action={createClientAction}
            initial={{ name: prefill.name, email: prefill.email }}
            submitLabel="Add client"
            clearOnSuccess
          />
        </section>

        <section className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="eyebrow bg-paper-alt text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-soft">
                    No clients yet.
                  </td>
                </tr>
              )}
              {clients.map((c) => {
                const p = programProgress(c.programStart, c.programEnd, now);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{c.email}</td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      {c.programStart && c.programEnd ? `${formatDate(c.programStart)} – ${formatDate(c.programEnd)}` : "Not set"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p
                        ? p.phase === "active"
                          ? `${p.percent}% · ${p.daysRemaining}d left`
                          : p.phase === "completed"
                            ? "Completed"
                            : "Not started"
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/clients/${c.id}`} className="link">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
