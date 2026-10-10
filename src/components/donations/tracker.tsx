import { CircleCheckBig, ClipboardCheck, FilePlus2, Package, PackageCheck, Truck, X, type LucideIcon } from "lucide-react";
import { DONATION_STATUS_FLOW, DONATION_STATUS_LABELS } from "@/lib/descriptors";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import type { TimelineEntryDTO } from "@/lib/dto/donations";
import type { DonationStatus } from "@prisma/client";

const STEP_ICONS: Record<DonationStatus, LucideIcon> = {
  CREATED: FilePlus2,
  CONFIRMED: ClipboardCheck,
  PREPARING: Package,
  IN_TRANSIT: Truck,
  RECEIVED: PackageCheck,
  COMPLETED: CircleCheckBig,
  CANCELLED: X,
};

/**
 * Status timeline: Created → Confirmed → Preparing → In transit → Received → Completed.
 * Horizontal on wider screens, vertical on phones; notes are listed underneath.
 */
export function DonationTracker({ status, timeline }: { status: string; timeline: TimelineEntryDTO[] }) {
  const cancelled = status === "CANCELLED";
  const currentIndex = DONATION_STATUS_FLOW.indexOf(status as DonationStatus);
  const at = (s: string) => timeline.find((t) => t.status === s);
  const steps = cancelled
    ? [...DONATION_STATUS_FLOW.filter((s) => at(s)), "CANCELLED" as DonationStatus]
    : DONATION_STATUS_FLOW;
  const reached = (i: number) => (cancelled ? true : i <= currentIndex);
  const updates = [...timeline].reverse();

  return (
    <div className="@container">
      <ol className="flex flex-col gap-5 @xl:flex-row @xl:gap-0" aria-label="Donation status timeline">
        {steps.map((s, i) => {
          const entry = at(s);
          const done = reached(i);
          const current = !cancelled && i === currentIndex;
          const isCancel = s === "CANCELLED";
          const Icon = STEP_ICONS[s];
          return (
            <li
              key={s}
              className="relative flex animate-rise items-center gap-3 @xl:flex-1 @xl:flex-col @xl:gap-2 @xl:text-center"
              style={{ animationDelay: `${i * 80}ms` }}
              aria-current={current ? "step" : undefined}
            >
              {i > 0 && (
                <span
                  className={cn(
                    "absolute -top-5 left-[19px] h-5 w-0.5 @xl:left-auto @xl:right-1/2 @xl:top-5 @xl:h-0.5 @xl:w-[calc(100%-3rem)] @xl:-translate-x-6",
                    done ? "bg-primary" : "bg-line",
                  )}
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2",
                  isCancel ? "border-critical bg-critical-soft text-critical" : done ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-subtle",
                  current && "ring-4 ring-primary/20",
                )}
              >
                <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
              </span>
              <div>
                <p className={cn("text-sm font-semibold", done ? "text-fg" : "text-subtle")}>{DONATION_STATUS_LABELS[s]}</p>
                {current && <span className="mt-0.5 inline-block rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-ink">Current</span>}
                {entry && <p className="text-xs text-muted">{formatDate(entry.at, { year: undefined })}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {updates.length > 0 && (
        <div className="mt-8 border-t border-line pt-5">
          <h3 className="text-sm font-semibold">Updates</h3>
          <ul className="mt-3 space-y-3">
            {updates.map((e) => (
              <li key={`${e.status}-${e.at}`} className="flex gap-3 text-sm">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", e.status === "CANCELLED" ? "bg-critical" : "bg-primary")} aria-hidden="true" />
                <div>
                  <p className="font-medium text-fg">{DONATION_STATUS_LABELS[e.status as DonationStatus] ?? e.status}</p>
                  <p className="text-muted">{formatDateTime(e.at)} · by {e.by}</p>
                  {e.note && <p className="mt-0.5 text-muted">{e.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
