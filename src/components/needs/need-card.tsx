import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import type { PublicRequestDTO } from "@/lib/dto/requests";
import { ProgressBar } from "@/components/ui/progress";
import { buttonClass } from "@/components/ui/button";
import { UrgencyBadge, VerificationBadge } from "@/components/brand/badges";
import { formatDate, formatNumber } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/fulfillment";

export function NeedCard({ need, index = 0 }: { need: PublicRequestDTO; index?: number }) {
  const shown = need.items.slice(0, 3);
  const more = need.items.length - shown.length;
  return (
    <article
      className="card card-hover flex h-full animate-rise flex-col p-5"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      aria-labelledby={`need-${need.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">
          <span aria-hidden="true">{need.category.icon}</span> {need.category.name}
        </span>
        <UrgencyBadge priority={need.priority} />
      </div>

      <h3 id={`need-${need.id}`} className="mt-4 text-lg font-semibold leading-snug text-fg">
        <Link href={`/needs/${need.id}`} className="after:absolute after:inset-0 hover:text-primary-ink focus-visible:shadow-none">
          {need.title}
        </Link>
      </h3>

      <ul className="mt-2 space-y-0.5 text-sm text-muted">
        {shown.map((i) =>
          i.remaining > 0 ? (
            <li key={i.id}>
              <span className="font-semibold text-fg">{formatNumber(i.remaining)}</span> {i.unit !== "pcs" ? `${i.unit} ` : ""}
              {i.name.toLowerCase()} <span className="text-subtle">still needed</span>
            </li>
          ) : (
            <li key={i.id} className="text-secondary-ink">✓ {i.name} — fully committed</li>
          ),
        )}
        {more > 0 && <li className="text-subtle">+{more} more item{more > 1 ? "s" : ""}</li>}
      </ul>

      <div className="mt-auto pt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
          <span className="text-primary-ink">{STAGE_LABELS[need.stage]}</span>
          <span className="text-muted">{need.percent}% fulfilled</span>
        </div>
        <ProgressBar value={need.percent} label={`${need.title}: ${need.percent}% fulfilled`} />

        <dl className="mt-4 grid grid-cols-1 gap-1.5 text-sm text-muted">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Location</dt>
            <MapPin className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
            <dd>{need.location.city ? `${need.location.city}, ` : ""}{need.location.district} District</dd>
          </div>
          {need.neededBy && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Needed by</dt>
              <CalendarDays className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
              <dd>Needed by {formatDate(need.neededBy, { year: undefined })}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{need.recipient.descriptor}</p>
            <div className="mt-1"><VerificationBadge verified={need.recipient.verified} /></div>
          </div>
          <Link href={`/needs/${need.id}?donate=1`} className={buttonClass("primary", "sm", "relative z-10 h-10 px-4")} aria-label={`Help with: ${need.title}`}>
            Help
          </Link>
        </div>
      </div>
    </article>
  );
}

export function NeedCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3 p-5" aria-hidden="true">
      <div className="flex justify-between"><div className="shimmer h-6 w-24 rounded-full" /><div className="shimmer h-6 w-16 rounded-full" /></div>
      <div className="shimmer mt-2 h-6 w-4/5 rounded-lg" />
      <div className="shimmer h-4 w-3/5 rounded-lg" />
      <div className="shimmer mt-6 h-2.5 w-full rounded-full" />
      <div className="shimmer h-4 w-1/2 rounded-lg" />
      <div className="shimmer mt-3 h-10 w-full rounded-xl" />
    </div>
  );
}
