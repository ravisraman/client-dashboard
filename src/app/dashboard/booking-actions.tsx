"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelBookingAction } from "./actions";

export function BookingActions({ uid, title, blockedReason }: { uid: string; title: string; blockedReason: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (blockedReason) {
    return <p className="max-w-xs text-xs text-ink-soft sm:text-right">{blockedReason}</p>;
  }

  if (confirming) {
    return (
      <div className="w-full max-w-xs space-y-2 border border-accent-soft bg-accent-soft/30 p-3 text-sm">
        <p>Cancel &ldquo;{title}&rdquo;?</p>
        <input
          className="input"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
        {error && <p className="text-accent">{error}</p>}
        <div className="flex gap-2">
          <button
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await cancelBookingAction({ uid, reason });
                if (!res.ok) setError(res.error);
              })
            }
          >
            {pending ? "Cancelling…" : "Yes, cancel"}
          </button>
          <button className="btn-secondary" disabled={pending} onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Link href={`/dashboard/reschedule/${encodeURIComponent(uid)}`} className="btn-secondary">
        Change time
      </Link>
      <button className="btn-danger" onClick={() => setConfirming(true)}>
        Cancel
      </button>
    </div>
  );
}
