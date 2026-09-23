"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDateTime, formatDayHeading, formatTime } from "@/lib/format";
import { rescheduleBookingAction } from "../../actions";

export function SlotPicker({
  uid,
  slots,
  timeZone,
  currentStart,
}: {
  uid: string;
  slots: Record<string, string[]>;
  timeZone: string;
  currentStart: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const days = Object.keys(slots).sort();
  const currentMs = Date.parse(currentStart);

  if (days.every((d) => slots[d].length === 0)) {
    return <p className="mt-6 text-sm text-ink-soft">No available times this week. Try a later week.</p>;
  }

  return (
    <div className="mt-5 space-y-5">
      {days.map((day) =>
        slots[day].length === 0 ? null : (
          <div key={day}>
            <h3 className="eyebrow mb-2">{formatDayHeading(day)}</h3>
            <div className="flex flex-wrap gap-2">
              {slots[day].map((start) => {
                const isCurrent = Date.parse(start) === currentMs;
                return (
                  <button
                    key={start}
                    disabled={isCurrent || pending}
                    onClick={() => {
                      setSelected(start);
                      setError(null);
                    }}
                    className={`border px-3 py-1.5 text-sm ${
                      selected === start
                        ? "border-accent bg-accent text-paper"
                        : "border-rule-strong bg-paper hover:border-accent"
                    } disabled:opacity-40`}
                    title={isCurrent ? "Current time" : undefined}
                  >
                    {formatTime(start, timeZone)}
                  </button>
                );
              })}
            </div>
          </div>
        ),
      )}

      {selected && (
        <div className="sticky bottom-4 border border-rule bg-paper p-4">
          <p className="text-sm">
            Move to <strong>{formatDateTime(selected, timeZone)}</strong>?
          </p>
          {error && <p className="mt-2 text-sm text-accent">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await rescheduleBookingAction({ uid, start: selected });
                  if (res.ok) {
                    router.push("/dashboard");
                    router.refresh();
                  } else setError(res.error);
                })
              }
            >
              {pending ? "Saving…" : "Confirm new time"}
            </button>
            <button className="btn-secondary" disabled={pending} onClick={() => setSelected(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
