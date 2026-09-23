import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { env } from "@/lib/env";
import { loadReport, parseRange } from "@/lib/report";
import { durationMinutes, isActive } from "@/lib/bookings";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function csvCell(value: string | number) {
  const s = String(value);
  // Quote everything and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const report = await loadReport(
    parseRange({ from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined }),
  );
  const tz = env.adminTimeZone();
  const now = Date.now();

  const rows: (string | number)[][] = [["Client", "Email", "Session", "Start", "Duration (min)", "Status"]];
  for (const r of report.clients) {
    for (const s of r.sessions) {
      const status = !isActive(s) ? "cancelled" : Date.parse(s.end) > now ? "upcoming" : "completed";
      rows.push([r.client.name, r.client.email, s.title, formatDateTime(s.start, tz), durationMinutes(s), status]);
    }
  }
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="client-sessions-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
