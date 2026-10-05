import { cn } from "./cn";

export function ProgressBar({
  value,
  label,
  className,
  size = "md",
  tone = "primary",
}: {
  value: number;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "primary" | "success" | "accent";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const h = size === "sm" ? "h-1.5" : size === "lg" ? "h-3.5" : "h-2.5";
  const fill =
    tone === "success"
      ? "bg-secondary"
      : tone === "accent"
        ? "bg-accent"
        : "bg-[linear-gradient(90deg,var(--primary),color-mix(in_oklab,var(--primary)_55%,var(--secondary)))]";
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${pct}% fulfilled`}
      className={cn("w-full overflow-hidden rounded-full bg-surface-3", h, className)}
    >
      <div className={cn("progress-fill h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
