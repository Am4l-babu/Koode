import type { ReactNode } from "react";
import { cn } from "./cn";

export function MetricCard({ label, value, hint, icon, tone = "primary", href }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "primary" | "success" | "accent" | "info" | "critical"; href?: string }) {
  const toneCls = { primary: "bg-primary-soft text-primary-ink", success: "bg-secondary-soft text-secondary-ink", accent: "bg-accent-soft text-accent-ink", info: "bg-info-soft text-info", critical: "bg-critical-soft text-critical" }[tone];
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", toneCls)} aria-hidden="true">{icon}</span>}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-fg">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  return href ? <a href={href} className="card card-hover block p-5">{inner}</a> : <div className="card p-5">{inner}</div>;
}
