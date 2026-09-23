import Link from "next/link";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/session";
import { env } from "@/lib/env";
import { loadReport, parseRange } from "@/lib/report";
import { isActive } from "@/lib/bookings";
import { formatDate, formatDateTime, formatHours } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const admin = await requireAdmin();
  const range = parseRange(await searchParams);
  const tz = env.adminTimeZone();

  let report: Awaited<ReturnType<typeof loadReport>> | null = null;
  try {
    report = await loadReport(range);
  } catch (e) {
    console.error(e);
  }

  const qs = new URLSearchParams(Object.entries(range).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <Header user={admin} />
      <main className="space-y-8 px-5 py-10 sm:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl leading-tight sm:text-5xl">Client report</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {range.from || range.to
                ? `Sessions ${range.from ? `from ${formatDate(range.from)}` : ""} ${range.to ? `to ${formatDate(range.to)}` : ""}`
                : "All sessions"}{" "}
              · times in {tz.replace(/_/g, " ")}
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="from">
                From
              </label>
              <input className="input" type="date" id="from" name="from" defaultValue={range.from} />
            </div>
            <div>
              <label className="label" htmlFor="to">
                To
              </label>
              <input className="input" type="date" id="to" name="to" defaultValue={range.to} />
            </div>
            <button className="btn-secondary">Apply</button>
            {(range.from || range.to) && (
              <Link href="/admin" className="btn-secondary">
                Clear
              </Link>
            )}
            <a href={`/admin/report.csv${qs ? `?${qs}` : ""}`} className="btn-secondary">
              Export CSV
            </a>
          </form>
        </div>

        {!report ? (
          <div className="card text-sm text-accent">
            Couldn&apos;t load bookings from Cal.com. Check CALCOM_API_KEY and try again.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Clients" value={report.totals.clients} />
              <Stat label="Total sessions" value={report.totals.totalSessions} />
              <Stat label="Hours booked" value={formatHours(report.totals.totalMinutes)} />
              <Stat label="Completed" value={report.totals.completed} />
              <Stat label="Upcoming" value={report.totals.upcoming} />
            </div>

            <section className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="eyebrow bg-paper-alt text-left">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Program</th>
                    <th className="px-4 py-3 text-right">Sessions</th>
                    <th className="px-4 py-3 text-right">Hours</th>
                    <th className="px-4 py-3 text-right">Done</th>
                    <th className="px-4 py-3 text-right">Upcoming</th>
                    <th className="px-4 py-3 text-right">Cancelled</th>
                  </tr>
                </thead>
                {report.clients.length === 0 && (
                  <tbody>
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-ink-soft">
                        No clients yet.{" "}
                        <Link href="/admin/clients" className="link">
                          Add your first client
                        </Link>
                        .
                      </td>
                    </tr>
                  </tbody>
                )}
                {report.clients.map((r) => (
                  <tbody key={r.client.id} className="border-t border-rule">
                    <tr>
                      <td className="px-4 py-3">
                        <Link href={`/admin/clients/${r.client.id}`} className="text-ink no-underline hover:text-accent">
                          {r.client.name}
                        </Link>
                        <div className="text-xs text-ink-soft">{r.client.email}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-soft">
                        {r.client.programStart && r.client.programEnd
                          ? `${formatDate(r.client.programStart)} – ${formatDate(r.client.programEnd)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{r.totalSessions}</td>
                      <td className="px-4 py-3 text-right">{formatHours(r.totalMinutes)}</td>
                      <td className="px-4 py-3 text-right">{r.completed}</td>
                      <td className="px-4 py-3 text-right">{r.upcoming}</td>
                      <td className="px-4 py-3 text-right text-ink-soft">{r.cancelled}</td>
                    </tr>
                    {r.sessions.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 pb-3">
                          <details>
                            <summary className="cursor-pointer text-xs text-accent">Show {r.sessions.length} session(s)</summary>
                            <ul className="mt-2 space-y-1 bg-paper-alt p-3">
                              {r.sessions.map((s) => (
                                <li
                                  key={s.uid}
                                  className={`flex justify-between gap-4 text-xs ${isActive(s) ? "" : "text-ink-faint line-through"}`}
                                >
                                  <span>{s.title}</span>
                                  <span>
                                    {formatDateTime(s.start, tz)} · {s.duration} min
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                      </tr>
                    )}
                  </tbody>
                ))}
              </table>
            </section>

            {report.unmatched.length > 0 && (
              <section className="card">
                <h2 className="text-2xl">Bookings from people who aren&apos;t clients yet</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  These attendees booked through Cal.com but have no portal account, so they aren&apos;t counted above.
                </p>
                <ul className="mt-3 divide-y divide-rule text-sm">
                  {report.unmatched.map((u) => (
                    <li key={u.email} className="flex items-center justify-between py-2">
                      <span>
                        {u.name || "—"} <span className="text-ink-soft">&lt;{u.email}&gt;</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-ink-soft">{u.sessions} session(s)</span>
                        <Link href={`/admin/clients?${new URLSearchParams({ name: u.name, email: u.email })}`} className="link">
                          Add as client
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-serif text-4xl text-ink">{value}</p>
    </div>
  );
}
