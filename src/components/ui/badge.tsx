import type { ReactNode } from "react";
import { cn } from "./cn";

export type Tone = "neutral" | "primary" | "success" | "accent" | "critical" | "high" | "medium" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  primary: "bg-primary-soft text-primary-ink border-transparent",
  success: "bg-secondary-soft text-secondary-ink border-transparent",
  accent: "bg-accent-soft text-accent-ink border-transparent",
  critical: "bg-critical-soft text-critical border-transparent",
  high: "bg-high-soft text-high border-transparent",
  medium: "bg-medium-soft text-medium border-transparent",
  info: "bg-info-soft text-info border-transparent",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
