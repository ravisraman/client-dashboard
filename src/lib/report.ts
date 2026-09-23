import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { listBookings } from "./calcom";
import { buildReport } from "./bookings";

export type ReportRange = { from?: string; to?: string };

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function parseRange(params: { from?: string; to?: string }): ReportRange {
  return {
    from: params.from && YMD.test(params.from) ? params.from : undefined,
    to: params.to && YMD.test(params.to) ? params.to : undefined,
  };
}

export async function loadReport(range: ReportRange) {
  const filters = {
    afterStart: range.from ? `${range.from}T00:00:00.000Z` : undefined,
    beforeEnd: range.to ? `${range.to}T23:59:59.999Z` : undefined,
  };
  const [clients, ...bookingLists] = await Promise.all([
    getDb().select().from(user).where(eq(user.role, "client")).all(),
    listBookings({ status: "upcoming", ...filters }),
    listBookings({ status: "unconfirmed", ...filters }),
    listBookings({ status: "past", ...filters }),
    listBookings({ status: "cancelled", ...filters }),
  ]);
  return buildReport(clients, bookingLists.flat(), new Date());
}
