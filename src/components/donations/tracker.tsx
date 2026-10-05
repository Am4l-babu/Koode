import { Check, Circle, X } from "lucide-react";
import { DONATION_STATUS_FLOW, DONATION_STATUS_LABELS } from "@/lib/descriptors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import type { TimelineEntryDTO } from "@/lib/dto/donations";
import type { DonationStatus } from "@prisma/client";

/** Animated status timeline: Created → Confirmed → Preparing → In transit → Received → Completed. */
export function DonationTracker({ status, timeline }: { status: string; timeline: TimelineEntryDTO[] }) {
  const cancelled = status === "CANCELLED";
  const currentIndex = DONATION_STATUS_FLOW.indexOf(status as DonationStatus);
  const at = (s: string) => timeline.find((t) => t.status === s);
  const steps = cancelled
    ? [...DONATION_STATUS_FLOW.filter((s) => at(s)), "CANCELLED" as DonationStatus]
    : DONATION_STATUS_FLOW;

  return (
    <ol className="relative space-y-0" aria-label="Donation status timeline">
      {steps.map((s, i) => {
        const entry = at(s);
        const done = cancelled ? true : i <= currentIndex;
        const current = !cancelled && i === currentIndex;
        const isCancel = s === "CANCELLED";
        return (
          <li key={s} className="relative flex gap-4 pb-6 last:pb-0 animate-rise" style={{ animationDelay: `${i * 90}ms` }} aria-current={current ? "step" : undefined}>
            {i < steps.length - 1 && (
              <span className={cn("absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-0.5", done && i < (cancelled ? steps.length - 1 : currentIndex) ? "bg-secondary" : "bg-line")} aria-hidden="true" />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                isCancel ? "border-critical bg-critical-soft text-critical" : done ? "border-secondary bg-secondary text-white" : "border-line bg-surface text-subtle",
                current && "ring-4 ring-secondary/25",
              )}
            >
              {isCancel ? <X className="h-4 w-4" /> : done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Circle className="h-2.5 w-2.5" />}
            </span>
            <div className="pt-1">
              <p className={cn("font-semibold", done ? "text-fg" : "text-subtle")}>
                {DONATION_STATUS_LABELS[s]}
                {current && <span className="ml-2 rounded-full bg-secondary-soft px-2 py-0.5 text-xs font-semibold text-secondary-ink">Current</span>}
              </p>
              {entry && <p className="text-sm text-muted">{formatDateTime(entry.at)} · by {entry.by}</p>}
              {entry?.note && <p className="mt-0.5 text-sm text-muted">{entry.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "CANCELLED" ? "bg-critical-soft text-critical" :
    status === "RECEIVED" || status === "COMPLETED" ? "bg-secondary-soft text-secondary-ink" :
    status === "IN_TRANSIT" ? "bg-info-soft text-info" :
    "bg-primary-soft text-primary-ink";
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>{DONATION_STATUS_LABELS[status as DonationStatus] ?? status}</span>;
}
