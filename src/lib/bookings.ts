// Pure booking logic (no I/O) so it can be unit tested.

export type BookingLike = {
  uid: string;
  status: string;
  start: string;
  end: string;
  duration?: number;
  attendees: { email: string; name?: string; timeZone?: string }[];
};

const INACTIVE_STATUSES = new Set(["cancelled", "rejected"]);

export function isActive(b: Pick<BookingLike, "status">) {
  return !INACTIVE_STATUSES.has(b.status.toLowerCase());
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAttendee(b: BookingLike, email: string) {
  const target = normalizeEmail(email);
  return b.attendees.some((a) => normalizeEmail(a.email) === target);
}

export function durationMinutes(b: BookingLike) {
  if (typeof b.duration === "number" && b.duration > 0) return b.duration;
  return Math.max(0, Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60_000));
}

/**
 * Whether a client may still cancel/reschedule this booking.
 * Returns a reason string when not allowed, or null when allowed.
 */
export function changeBlockedReason(b: BookingLike, now: Date, cutoffHours: number): string | null {
  if (!isActive(b)) return "This session has already been cancelled.";
  const start = Date.parse(b.start);
  if (start <= now.getTime()) return "This session has already started or finished.";
  if (cutoffHours > 0 && start - now.getTime() < cutoffHours * 3_600_000) {
    return `Sessions can't be changed online less than ${cutoffHours} hours before they start. Please contact your coach.`;
  }
  return null;
}

export function splitUpcomingPast<T extends BookingLike>(bookings: T[], now: Date) {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const b of bookings) (Date.parse(b.end) > now.getTime() ? upcoming : past).push(b);
  upcoming.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  past.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  return { upcoming, past };
}

export function dedupeByUid<T extends { uid: string }>(bookings: T[]): T[] {
  const seen = new Map<string, T>();
  for (const b of bookings) seen.set(b.uid, b);
  return [...seen.values()];
}

export type ClientRow = { id: string; name: string; email: string; programStart?: string | null; programEnd?: string | null };

export type ClientReport<C extends ClientRow, B extends BookingLike> = {
  client: C;
  sessions: B[];
  completed: number;
  upcoming: number;
  cancelled: number;
  totalSessions: number;
  totalMinutes: number;
};

export type Report<C extends ClientRow, B extends BookingLike> = {
  clients: ClientReport<C, B>[];
  /** Attendee emails that booked but aren't set up as clients in the portal. */
  unmatched: { email: string; name: string; sessions: number }[];
  totals: {
    clients: number;
    totalSessions: number;
    completed: number;
    upcoming: number;
    cancelled: number;
    totalMinutes: number;
  };
};

/**
 * Groups bookings by client (matched on attendee email) and computes stats.
 * Cancelled/rejected bookings are listed but excluded from session and hour totals.
 */
export function buildReport<C extends ClientRow, B extends BookingLike>(clients: C[], bookings: B[], now: Date): Report<C, B> {
  const byEmail = new Map<string, ClientReport<C, B>>();
  for (const client of clients) {
    byEmail.set(normalizeEmail(client.email), {
      client,
      sessions: [],
      completed: 0,
      upcoming: 0,
      cancelled: 0,
      totalSessions: 0,
      totalMinutes: 0,
    });
  }

  const unmatched = new Map<string, { email: string; name: string; sessions: number }>();

  for (const b of dedupeByUid(bookings)) {
    const matched = new Set<ClientReport<C, B>>();
    for (const a of b.attendees) {
      const email = normalizeEmail(a.email);
      const row = byEmail.get(email);
      if (row) {
        matched.add(row);
      } else if (isActive(b)) {
        const u = unmatched.get(email) ?? { email, name: a.name ?? "", sessions: 0 };
        u.sessions += 1;
        unmatched.set(email, u);
      }
    }
    for (const row of matched) {
      row.sessions.push(b);
      if (!isActive(b)) {
        row.cancelled += 1;
        continue;
      }
      row.totalSessions += 1;
      row.totalMinutes += durationMinutes(b);
      if (Date.parse(b.end) > now.getTime()) row.upcoming += 1;
      else row.completed += 1;
    }
  }

  const rows = [...byEmail.values()];
  for (const r of rows) r.sessions.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  rows.sort((a, b) => b.totalSessions - a.totalSessions || a.client.name.localeCompare(b.client.name));

  const totals = rows.reduce(
    (t, r) => ({
      clients: t.clients + 1,
      totalSessions: t.totalSessions + r.totalSessions,
      completed: t.completed + r.completed,
      upcoming: t.upcoming + r.upcoming,
      cancelled: t.cancelled + r.cancelled,
      totalMinutes: t.totalMinutes + r.totalMinutes,
    }),
    { clients: 0, totalSessions: 0, completed: 0, upcoming: 0, cancelled: 0, totalMinutes: 0 },
  );

  return {
    clients: rows,
    unmatched: [...unmatched.values()].sort((a, b) => b.sessions - a.sessions),
    totals,
  };
}

/** Progress through a program given YYYY-MM-DD start/end dates. */
export function programProgress(start: string | null | undefined, end: string | null | undefined, now: Date) {
  if (!start || !end) return null;
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T23:59:59Z`);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  const t = now.getTime();
  const totalDays = Math.round((e - s) / 86_400_000);
  const percent = t <= s ? 0 : t >= e ? 100 : Math.round(((t - s) / (e - s)) * 100);
  const daysRemaining = Math.max(0, Math.ceil((e - t) / 86_400_000));
  const phase: "not-started" | "active" | "completed" = t < s ? "not-started" : t > e ? "completed" : "active";
  return { percent, daysRemaining, totalDays, phase };
}
