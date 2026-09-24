import { calCancelUrl, calRescheduleUrl } from "@/lib/calcom";

/** Change time / Cancel open Cal.com's own pages (full availability, calendar overlay, confirmation emails). */
export function BookingActions({ uid, blockedReason }: { uid: string; blockedReason: string | null }) {
  if (blockedReason) {
    return <p className="max-w-xs text-xs text-ink-soft sm:text-right">{blockedReason}</p>;
  }

  return (
    <div className="flex gap-2">
      <a href={calRescheduleUrl(uid)} target="_blank" rel="noopener noreferrer" className="btn-secondary">
        Change time
      </a>
      <a href={calCancelUrl(uid)} target="_blank" rel="noopener noreferrer" className="btn-danger">
        Cancel
      </a>
    </div>
  );
}
