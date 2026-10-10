import Link from "next/link";
import { BadgeCheck, Clock, MapPin } from "lucide-react";
import type { PublicRequestDTO } from "@/lib/dto/requests";
import { ProgressBar } from "@/components/ui/progress";
import { buttonClass } from "@/components/ui/button";
import { UrgencyBadge } from "@/components/brand/badges";
import { CategoryArt, CategoryIcon } from "@/components/brand/category-visual";
import { daysLeft, formatNumber } from "@/lib/format";

/** What is still needed, in one line: "12 remaining of 40", or the open items for mixed units. */
export function remainingSummary(need: Pick<PublicRequestDTO, "items" | "totals">) {
  if (need.items.length === 1) {
    const i = need.items[0]!;
    const unit = i.unit !== "pcs" ? ` ${i.unit}` : "";
    return i.remaining > 0 ? `${formatNumber(i.remaining)}${unit} remaining of ${formatNumber(i.required)}` : "Fully committed";
  }
  const open = need.items.filter((i) => i.remaining > 0);
  if (!open.length) return "Fully committed";
  return open
    .slice(0, 2)
    .map((i) => `${formatNumber(i.remaining)}${i.unit !== "pcs" ? ` ${i.unit}` : ""} ${i.name.toLowerCase()}`)
    .join(" · ")
    .concat(open.length > 2 ? ` +${open.length - 2} more` : "", " still needed");
}

export function NeedCard({ need, index = 0 }: { need: PublicRequestDTO; index?: number }) {
  const due = daysLeft(need.neededBy);
  return (
    <article
      className="card card-hover relative flex h-full animate-rise flex-col overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      aria-labelledby={`need-${need.id}`}
    >
      <CategoryArt slug={need.category.slug} emoji={need.category.icon} className="h-40">
        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 py-1 pl-1 pr-2.5 text-xs font-semibold text-fg shadow-soft">
            <CategoryIcon slug={need.category.slug} emoji={need.category.icon} className="h-5 w-5 rounded-full" iconClassName="h-3 w-3" />
            {need.category.name}
          </span>
          <UrgencyBadge priority={need.priority} className="shadow-soft" />
        </div>
      </CategoryArt>

      <div className="flex flex-1 flex-col p-5">
        <h3 id={`need-${need.id}`} className="text-lg font-semibold leading-snug text-fg">
          <Link href={`/needs/${need.id}`} className="after:absolute after:inset-0 hover:text-primary-ink focus-visible:shadow-none">
            {need.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">{remainingSummary(need)}</p>

        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-secondary-ink">
          <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{need.recipient.verified ? need.recipient.descriptor : `${need.recipient.descriptor} (pending verification)`}</span>
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
            {need.location.city ? `${need.location.city}, ` : ""}{need.location.district}
          </span>
          {due && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
              {due}
            </span>
          )}
        </p>

        <div className="mt-auto pt-5">
          <div className="flex items-center gap-3">
            <ProgressBar value={need.percent} size="sm" label={`${need.title}: ${need.percent}% fulfilled`} />
            <span className="shrink-0 text-xs font-semibold text-muted">{need.percent}% fulfilled</span>
          </div>
          <div className="relative z-10 mt-4 flex gap-2">
            <Link href={`/needs/${need.id}`} className={buttonClass("outline", "sm", "h-10 flex-1 border-primary/40 text-primary-ink")} aria-label={`View details: ${need.title}`}>
              View Details
            </Link>
            <Link href={`/needs/${need.id}?donate=1`} className={buttonClass("primary", "sm", "h-10 px-4")} aria-label={`Help with: ${need.title}`}>
              Help
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function NeedCardSkeleton() {
  return (
    <div className="card flex flex-col overflow-hidden" aria-hidden="true">
      <div className="shimmer h-40 w-full" />
      <div className="flex flex-col gap-3 p-5">
        <div className="shimmer h-6 w-4/5 rounded-lg" />
        <div className="shimmer h-4 w-3/5 rounded-lg" />
        <div className="shimmer mt-6 h-2 w-full rounded-full" />
        <div className="shimmer mt-3 h-10 w-full rounded-full" />
      </div>
    </div>
  );
}
