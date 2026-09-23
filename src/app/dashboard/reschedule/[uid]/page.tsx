import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/session";
import { env } from "@/lib/env";
import { CalApiError, getAvailableSlots, getBooking } from "@/lib/calcom";
import { changeBlockedReason, isAttendee } from "@/lib/bookings";
import { formatDateTime, isValidTimeZone } from "@/lib/format";
import { SlotPicker } from "./slot-picker";

export const dynamic = "force-dynamic";

const DAYS_PER_PAGE = 7;

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function ReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ uid: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireUser();
  const { uid } = await params;
  const { from } = await searchParams;

  const booking = await getBooking(uid).catch((e) => {
    if (e instanceof CalApiError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  });
  if (!booking || !isAttendee(booking, user.email)) notFound();

  const attendeeTz = booking.attendees.find((a) => a.email.toLowerCase() === user.email.toLowerCase())?.timeZone;
  const timeZone = isValidTimeZone(attendeeTz) ? attendeeTz : env.adminTimeZone();
  const blocked = changeBlockedReason(booking, new Date(), env.changeCutoffHours());

  const today = new Date().toISOString().slice(0, 10);
  const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) && from > today ? from : today;
  const end = addDays(start, DAYS_PER_PAGE - 1);

  let slots: Record<string, string[]> = {};
  let slotsError = false;
  if (!blocked) {
    try {
      slots = await getAvailableSlots({ eventTypeId: booking.eventTypeId, start, end, timeZone, bookingUidToReschedule: uid });
    } catch (e) {
      console.error(e);
      slotsError = true;
    }
  }

  return (
    <>
      <Header user={user} />
      <main className="mx-auto max-w-3xl space-y-8 px-5 py-10 sm:px-12">
        <Link href="/dashboard" className="link text-sm">
          ← Back to dashboard
        </Link>
        <section className="card">
          <h1 className="text-3xl">Change time: {booking.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">Currently {formatDateTime(booking.start, timeZone)}</p>
          {blocked ? (
            <p className="mt-4 bg-warn-soft p-3 text-sm text-warn">{blocked}</p>
          ) : slotsError ? (
            <p className="mt-4 text-sm text-accent">We couldn&apos;t load available times. Please try again shortly.</p>
          ) : (
            <>
              <div className="mt-5 flex items-center justify-between text-sm">
                {start > today ? (
                  <Link className="btn-secondary" href={`?from=${addDays(start, -DAYS_PER_PAGE)}`}>
                    ← Earlier
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-ink-soft">Times shown in {timeZone.replace(/_/g, " ")}</span>
                <Link className="btn-secondary" href={`?from=${addDays(start, DAYS_PER_PAGE)}`}>
                  Later →
                </Link>
              </div>
              <SlotPicker uid={uid} slots={slots} timeZone={timeZone} currentStart={booking.start} />
            </>
          )}
        </section>
      </main>
    </>
  );
}
