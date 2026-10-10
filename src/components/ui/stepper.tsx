import { Check } from "lucide-react";
import { cn } from "./cn";

/** Numbered step indicator with labels under each step. */
export function Stepper({ steps, current, label, className }: { steps: readonly string[]; current: number; label: string; className?: string }) {
  return (
    <ol className={cn("flex items-start", className)} aria-label={label}>
      {steps.map((s, i) => (
        <li key={s} className="relative flex flex-1 flex-col items-center gap-1.5 text-center" aria-current={i === current ? "step" : undefined}>
          {i > 0 && (
            <span className={cn("absolute right-1/2 top-4 h-0.5 w-[calc(100%-2.5rem)] -translate-x-5 rounded-full", i <= current ? "bg-primary" : "bg-line")} aria-hidden="true" />
          )}
          <span
            className={cn(
              "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors",
              i < current ? "bg-primary text-primary-fg" : i === current ? "bg-primary text-primary-fg ring-4 ring-primary/20" : "border border-line-strong bg-surface text-muted",
            )}
          >
            {i < current ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : i + 1}
          </span>
          <span className={cn("text-xs font-semibold", i === current ? "text-fg" : "text-subtle")}>{s}</span>
        </li>
      ))}
    </ol>
  );
}
