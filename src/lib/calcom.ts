import "server-only";
import { env } from "./env";

// Cal.com API v2. Docs: https://cal.com/docs/api-reference/v2
const BOOKINGS_API_VERSION = "2024-08-13";
const SLOTS_API_VERSION = "2024-09-04";

export type CalAttendee = { name: string; email: string; timeZone: string };

export type CalBooking = {
  id: number;
  uid: string;
  title: string;
  description?: string | null;
  status: "accepted" | "cancelled" | "rejected" | "pending" | string;
  start: string;
  end: string;
  duration: number; // minutes
  eventTypeId: number;
  eventType?: { id: number; slug: string };
  meetingUrl?: string | null;
  location?: string | null;
  attendees: CalAttendee[];
};

export class CalApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function calFetch<T>(path: string, init: RequestInit & { apiVersion: string }): Promise<T> {
  const { apiVersion, ...rest } = init;
  const res = await fetch(`${env.calApiUrl()}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${env.calApiKey()}`,
      "cal-api-version": apiVersion,
      "Content-Type": "application/json",
      ...rest.headers,
    },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as {
    status?: string;
    message?: unknown;
    error?: { message?: unknown };
  } | null;
  if (!res.ok || body?.status === "error") {
    const message = body?.error?.message ?? body?.message ?? `Cal.com request failed (${res.status})`;
    throw new CalApiError(typeof message === "string" ? message : JSON.stringify(message), res.status);
  }
  return body as T;
}

type ListParams = {
  status?: "upcoming" | "past" | "cancelled" | "unconfirmed";
  attendeeEmail?: string;
  afterStart?: string;
  beforeEnd?: string;
};

/** Fetches every page of bookings matching the filters. */
export async function listBookings(params: ListParams): Promise<CalBooking[]> {
  const take = 100;
  const all: CalBooking[] = [];
  for (let skip = 0; ; skip += take) {
    const qs = new URLSearchParams({ take: String(take), skip: String(skip) });
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    const res = await calFetch<{ data: CalBooking[]; pagination?: { hasNextPage?: boolean } }>(`/v2/bookings?${qs}`, {
      apiVersion: BOOKINGS_API_VERSION,
    });
    all.push(...res.data);
    const more = res.pagination?.hasNextPage ?? res.data.length === take;
    if (!more || res.data.length === 0 || skip > 10_000) break;
  }
  return all;
}

export async function getBooking(uid: string): Promise<CalBooking> {
  const res = await calFetch<{ data: CalBooking }>(`/v2/bookings/${encodeURIComponent(uid)}`, {
    apiVersion: BOOKINGS_API_VERSION,
  });
  return res.data;
}

export async function cancelBooking(uid: string, reason: string) {
  await calFetch(`/v2/bookings/${encodeURIComponent(uid)}/cancel`, {
    method: "POST",
    apiVersion: BOOKINGS_API_VERSION,
    body: JSON.stringify({ cancellationReason: reason }),
  });
}

export async function rescheduleBooking(uid: string, start: string, reason: string, rescheduledBy: string) {
  const res = await calFetch<{ data: CalBooking }>(`/v2/bookings/${encodeURIComponent(uid)}/reschedule`, {
    method: "POST",
    apiVersion: BOOKINGS_API_VERSION,
    body: JSON.stringify({ start, reschedulingReason: reason, rescheduledBy }),
  });
  return res.data;
}

/** Available start times (ISO strings) grouped by local date, for rescheduling a booking. */
export async function getAvailableSlots(opts: {
  eventTypeId: number;
  start: string;
  end: string;
  timeZone: string;
  bookingUidToReschedule: string;
}): Promise<Record<string, string[]>> {
  const qs = new URLSearchParams({
    eventTypeId: String(opts.eventTypeId),
    start: opts.start,
    end: opts.end,
    timeZone: opts.timeZone,
    bookingUidToReschedule: opts.bookingUidToReschedule,
  });
  const res = await calFetch<{ data: Record<string, { start: string }[]> }>(`/v2/slots?${qs}`, {
    apiVersion: SLOTS_API_VERSION,
  });
  return Object.fromEntries(Object.entries(res.data).map(([day, slots]) => [day, slots.map((s) => s.start)]));
}
