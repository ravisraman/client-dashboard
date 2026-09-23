import { describe, expect, it } from "vitest";
import { buildReport, changeBlockedReason, durationMinutes, isAttendee, programProgress, splitUpcomingPast } from "./bookings";

const now = new Date("2026-06-15T12:00:00Z");

function booking(uid: string, start: string, minutes: number, email: string, status = "accepted") {
  const end = new Date(Date.parse(start) + minutes * 60_000).toISOString();
  return {
    uid,
    title: `Session ${uid}`,
    status,
    start,
    end,
    duration: minutes,
    attendees: [{ email, name: email.split("@")[0], timeZone: "UTC" }],
  };
}

describe("isAttendee", () => {
  it("matches case-insensitively and ignores whitespace", () => {
    expect(isAttendee(booking("a", "2026-06-20T10:00:00Z", 60, "Jane@Example.com"), " jane@example.COM ")).toBe(true);
    expect(isAttendee(booking("a", "2026-06-20T10:00:00Z", 60, "jane@example.com"), "john@example.com")).toBe(false);
  });
});

describe("durationMinutes", () => {
  it("falls back to start/end when duration is missing", () => {
    const b = { ...booking("a", "2026-06-20T10:00:00Z", 45, "x@y.com"), duration: undefined };
    expect(durationMinutes(b)).toBe(45);
  });
});

describe("changeBlockedReason", () => {
  it("allows changes outside the cutoff window", () => {
    expect(changeBlockedReason(booking("a", "2026-06-17T12:00:00Z", 60, "x@y.com"), now, 24)).toBeNull();
  });
  it("blocks changes inside the cutoff window", () => {
    expect(changeBlockedReason(booking("a", "2026-06-16T08:00:00Z", 60, "x@y.com"), now, 24)).toMatch(/24 hours/);
  });
  it("allows short-notice changes when the cutoff is disabled", () => {
    expect(changeBlockedReason(booking("a", "2026-06-15T13:00:00Z", 60, "x@y.com"), now, 0)).toBeNull();
  });
  it("blocks past and cancelled sessions", () => {
    expect(changeBlockedReason(booking("a", "2026-06-10T12:00:00Z", 60, "x@y.com"), now, 0)).toMatch(/already/);
    expect(changeBlockedReason(booking("a", "2026-07-10T12:00:00Z", 60, "x@y.com", "cancelled"), now, 0)).toMatch(/cancelled/);
  });
});

describe("splitUpcomingPast", () => {
  it("treats in-progress sessions as upcoming and sorts each list", () => {
    const b1 = booking("past-old", "2026-05-01T10:00:00Z", 60, "x@y.com");
    const b2 = booking("past-new", "2026-06-01T10:00:00Z", 60, "x@y.com");
    const b3 = booking("in-progress", "2026-06-15T11:30:00Z", 60, "x@y.com");
    const b4 = booking("future", "2026-07-01T10:00:00Z", 60, "x@y.com");
    const { upcoming, past } = splitUpcomingPast([b4, b1, b3, b2], now);
    expect(upcoming.map((b) => b.uid)).toEqual(["in-progress", "future"]);
    expect(past.map((b) => b.uid)).toEqual(["past-new", "past-old"]);
  });
});

describe("buildReport", () => {
  const clients = [
    { id: "1", name: "Ann", email: "ann@example.com" },
    { id: "2", name: "Bob", email: "BOB@example.com" },
    { id: "3", name: "Cat", email: "cat@example.com" },
  ];

  it("groups sessions per client and totals sessions and hours, excluding cancellations", () => {
    const bookings = [
      booking("a1", "2026-06-01T10:00:00Z", 60, "ann@example.com"),
      booking("a2", "2026-06-20T10:00:00Z", 30, "Ann@Example.com"),
      booking("a3", "2026-06-22T10:00:00Z", 60, "ann@example.com", "cancelled"),
      booking("b1", "2026-06-02T10:00:00Z", 90, "bob@example.com"),
      booking("b1", "2026-06-02T10:00:00Z", 90, "bob@example.com"), // duplicate across status lists
      booking("x1", "2026-06-03T10:00:00Z", 60, "stranger@example.com"),
      booking("x2", "2026-06-04T10:00:00Z", 60, "stranger@example.com", "rejected"),
    ];
    const report = buildReport(clients, bookings, now);

    const ann = report.clients.find((r) => r.client.id === "1")!;
    expect(ann).toMatchObject({ totalSessions: 2, totalMinutes: 90, completed: 1, upcoming: 1, cancelled: 1 });
    expect(ann.sessions.map((s) => s.uid)).toEqual(["a3", "a2", "a1"]);

    const bob = report.clients.find((r) => r.client.id === "2")!;
    expect(bob).toMatchObject({ totalSessions: 1, totalMinutes: 90, completed: 1 });

    const cat = report.clients.find((r) => r.client.id === "3")!;
    expect(cat.totalSessions).toBe(0);

    expect(report.totals).toEqual({ clients: 3, totalSessions: 3, completed: 2, upcoming: 1, cancelled: 1, totalMinutes: 180 });
    expect(report.unmatched).toEqual([{ email: "stranger@example.com", name: "stranger", sessions: 1 }]);
    // Busiest client first.
    expect(report.clients[0].client.name).toBe("Ann");
  });

  it("credits a group session to every client attending it", () => {
    const group = booking("g", "2026-06-01T10:00:00Z", 60, "ann@example.com");
    group.attendees.push({ email: "bob@example.com", name: "Bob", timeZone: "UTC" });
    const report = buildReport(clients, [group], now);
    expect(
      report.clients
        .filter((r) => r.totalSessions === 1)
        .map((r) => r.client.name)
        .sort(),
    ).toEqual(["Ann", "Bob"]);
  });
});

describe("programProgress", () => {
  it("returns null when dates are missing or inverted", () => {
    expect(programProgress(null, "2026-12-31", now)).toBeNull();
    expect(programProgress("2026-12-31", "2026-01-01", now)).toBeNull();
  });
  it("reports phase and progress", () => {
    expect(programProgress("2026-07-01", "2026-09-30", now)).toMatchObject({ phase: "not-started", percent: 0 });
    expect(programProgress("2026-01-01", "2026-03-31", now)).toMatchObject({
      phase: "completed",
      percent: 100,
      daysRemaining: 0,
    });
    const active = programProgress("2026-06-01", "2026-06-30", now)!;
    expect(active.phase).toBe("active");
    expect(active.percent).toBeGreaterThan(40);
    expect(active.percent).toBeLessThan(55);
    expect(active.daysRemaining).toBe(16);
  });
});
