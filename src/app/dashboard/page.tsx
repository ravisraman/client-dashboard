import { Suspense } from "react";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/session";
import { env } from "@/lib/env";
import { listBookings, type CalBooking } from "@/lib/calcom";
import {
  changeBlockedReason,
  dedupeByUid,
  findAttendee,
  isActive,
  isAttendee,
  programProgress,
  splitUpcomingPast,
} from "@/lib/bookings";
import { getClientEmails } from "@/lib/client-emails";
import { formatDate, formatDateTime, isValidTimeZone } from "@/lib/format";
import { BookingActions } from "./booking-actions";
import { BillingSection } from "./billing-section";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const user = await requireUser();
  const { billing } = await searchParams;
  const firstName = user.name?.split(" ")[0] || "there";

  return (
    <>
      <Header user={user} />
      <main className="space-y-8 px-5 py-10 sm:px-12">
        <h1 className="text-4xl sm:text-5xl">Hi {firstName} 👋</h1>
        <ProgramSection programName={user.programName} start={user.programStart} end={user.programEnd} />
        <Suspense fallback={<div className="card text-sm text-ink-soft">Loading your sessions…</div>}>
          <AppointmentsSection client={user} />
        </Suspense>
        {env.stripeEnabled() && (
          <Suspense fallback={<div className="card text-sm text-ink-soft">Loading billing…</div>}>
            <BillingSection user={user} missing={billing === "missing"} />
          </Suspense>
        )}
      </main>
    </>
  );
}

function ProgramSection({ programName, start, end }: { programName: string | null; start: string | null; end: string | null }) {
  const progress = programProgress(start, end, new Date());
  return (
    <section className="card">
      <h2 className="text-2xl">{programName || "Your coaching program"}</h2>
      {!start || !end ? (
        <p className="mt-2 text-sm text-ink-soft">Your program dates haven&apos;t been set yet. Your coach will add them soon.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="eyebrow">Start date</dt>
              <dd className="mt-1 font-serif text-xl text-ink">{formatDate(start)}</dd>
            </div>
            <div>
              <dt className="eyebrow">End date</dt>
              <dd className="mt-1 font-serif text-xl text-ink">{formatDate(end)}</dd>
            </div>
            {progress && (
              <div>
                <dt className="eyebrow">Status</dt>
                <dd className="mt-1 font-serif text-xl text-ink">
                  {progress.phase === "not-started"
                    ? "Starting soon"
                    : progress.phase === "completed"
                      ? "Completed 🎉"
                      : `${progress.daysRemaining} days remaining`}
                </dd>
              </div>
            )}
          </dl>
          {progress && (
            <div className="mt-4">
              <div
                className="h-2 overflow-hidden bg-rule-soft"
                role="progressbar"
                aria-valuenow={progress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-gradient-to-r from-brand-red via-brand-orange to-brand-amber"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-soft">{progress.percent}% through your program</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

async function AppointmentsSection({ client }: { client: { id: string; email: string } }) {
  const emails = await getClientEmails(client);
  let bookings: CalBooking[];
  try {
    const lists = await Promise.all(
      emails.flatMap((attendeeEmail) =>
        (["upcoming", "unconfirmed", "past"] as const).map((status) => listBookings({ status, attendeeEmail })),
      ),
    );
    // Defence in depth: only ever show bookings this client actually attends.
    bookings = dedupeByUid(lists.flat()).filter((b) => isAttendee(b, emails) && isActive(b));
  } catch (e) {
    console.error(e);
    return (
      <div className="card text-sm text-accent">We couldn&apos;t load your sessions right now. Please try again shortly.</div>
    );
  }

  const now = new Date();
  const { upcoming, past } = splitUpcomingPast(bookings, now);
  const cutoff = env.changeCutoffHours();
  const bookingUrl = env.bookingUrl();
  const tzOf = (b: CalBooking) => {
    const tz = findAttendee(b, emails)?.timeZone;
    return isValidTimeZone(tz) ? tz : env.adminTimeZone();
  };

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">Upcoming sessions</h2>
        {bookingUrl && (
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Book a session
          </a>
        )}
      </div>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">You have no upcoming sessions.</p>
      ) : (
        <ul className="mt-3 divide-y divide-rule">
          {upcoming.map((b) => (
            <li key={b.uid} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-serif text-xl text-ink">{b.title}</p>
                <p className="text-sm text-ink-soft">
                  {formatDateTime(b.start, tzOf(b))} · {b.duration} min
                  {b.status === "pending" && (
                    <span className="ml-2 bg-warn-soft px-1.5 py-0.5 text-xs text-warn">Awaiting confirmation</span>
                  )}
                </p>
                {b.meetingUrl && (
                  <a href={b.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-sm link">
                    Join link
                  </a>
                )}
              </div>
              <BookingActions uid={b.uid} blockedReason={changeBlockedReason(b, now, cutoff)} />
            </li>
          ))}
        </ul>
      )}

      {upcoming.length > 0 && (
        <p className="mt-3 text-xs text-ink-faint">
          Change time and Cancel open Cal.com in a new tab. Come back and refresh this page to see the update.
        </p>
      )}

      <h2 className="mt-10 text-2xl">Past sessions</h2>
      {past.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">No past sessions yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-rule">
          {past.map((b) => (
            <li key={b.uid} className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:justify-between sm:gap-4">
              <span className="font-medium">{b.title}</span>
              <span className="text-ink-soft sm:text-right">
                {formatDateTime(b.start, tzOf(b))} · {b.duration} min
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
