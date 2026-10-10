import type { ReactNode } from "react";
import { cn } from "./cn";

export function MetricCard({ label, value, hint, icon, tone = "primary", href }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "primary" | "success" | "accent" | "info" | "critical"; href?: string }) {
  const toneCls = { primary: "bg-primary-soft text-primary-ink", success: "bg-secondary-soft text-secondary-ink", accent: "bg-accent-soft text-accent-ink", info: "bg-info-soft text-info", critical: "bg-critical-soft text-critical" }[tone];
  const inner = (
    <>
      <div className="flex items-center gap-3">
        {icon && <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneCls)} aria-hidden="true">{icon}</span>}
        <p className="text-sm font-medium leading-tight text-muted">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-fg">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  return href ? <a href={href} className="card card-hover block p-5">{inner}</a> : <div className="card p-5">{inner}</div>;
}
