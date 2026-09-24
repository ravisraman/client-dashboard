import "server-only";
import { env } from "./env";

// Cal.com API v2. Docs: https://cal.com/docs/api-reference/v2
const BOOKINGS_API_VERSION = "2024-08-13";

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

/** Cal.com's own reschedule page for a booking (same link as in Cal.com's emails). */
export function calRescheduleUrl(uid: string) {
  return `${env.calAppUrl()}/reschedule/${encodeURIComponent(uid)}`;
}

/** Cal.com's own cancel page for a booking. */
export function calCancelUrl(uid: string) {
  return `${env.calAppUrl()}/booking/${encodeURIComponent(uid)}?cancel=true`;
}
