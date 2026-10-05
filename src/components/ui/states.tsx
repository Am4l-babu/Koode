import type { ReactNode } from "react";
import { cn } from "./cn";

export function EmptyState({ title, description, action, illustration = "sprout" }: { title: string; description?: ReactNode; action?: ReactNode; illustration?: "sprout" | "box" | "bell" }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <EmptyIllustration kind={illustration} />
      <h3 className="mt-5 text-xl font-semibold text-fg">{title}</h3>
      {description && <p className="mt-2 max-w-md text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function EmptyIllustration({ kind }: { kind: "sprout" | "box" | "bell" }) {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden="true" className="float-slow">
      <ellipse cx="60" cy="84" rx="40" ry="6" fill="var(--surface-3)" />
      {kind === "sprout" && (
        <>
          <rect x="40" y="56" width="40" height="26" rx="6" fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth="2" />
          <path d="M60 56 V30" stroke="var(--secondary)" strokeWidth="3" strokeLinecap="round" />
          <path d="M60 40 C 48 38, 42 28, 44 20 C 54 22, 60 30, 60 40Z" fill="var(--secondary)" />
          <path d="M60 34 C 70 32, 78 24, 76 14 C 66 16, 60 24, 60 34Z" fill="color-mix(in oklab, var(--secondary) 70%, var(--primary))" />
          <circle cx="86" cy="22" r="4" fill="var(--accent)" />
        </>
      )}
      {kind === "box" && (
        <>
          <path d="M30 40 L60 28 L90 40 L60 52Z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
          <path d="M30 40 V70 L60 82 V52Z" fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth="2" />
          <path d="M90 40 V70 L60 82 V52Z" fill="var(--surface-2)" stroke="var(--primary)" strokeWidth="2" />
          <path d="M52 46 C 52 38, 68 38, 68 46" stroke="var(--critical)" strokeWidth="2.5" fill="none" />
        </>
      )}
      {kind === "bell" && (
        <>
          <path d="M40 62 C 44 56, 42 34, 60 30 C 78 34, 76 56, 80 62Z" fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth="2" />
          <circle cx="60" cy="68" r="5" fill="var(--primary)" />
          <circle cx="60" cy="27" r="3" fill="var(--primary)" />
        </>
      )}
    </svg>
  );
}

export function ErrorState({ title = "Something didn't go as planned.", errorId, action }: { title?: string; errorId?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center" role="alert">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-2xl" aria-hidden="true">🧭</div>
      <h2 className="mt-4 text-xl font-semibold text-fg">{title}</h2>
      <p className="mt-2 max-w-md text-muted">Nothing you did is lost. You can try again, and if it keeps happening, share the reference below with our team.</p>
      {errorId && (
        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-sm text-muted">
          Request ID: <span className="font-semibold text-fg">{errorId}</span>
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} aria-hidden="true" />;
}

export function Callout({ tone = "info", title, children, icon }: { tone?: "info" | "success" | "warning" | "danger" | "privacy"; title?: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  const styles = {
    info: "bg-info-soft border-info/30 text-fg",
    success: "bg-secondary-soft border-secondary/40 text-fg",
    warning: "bg-accent-soft border-accent/40 text-fg",
    danger: "bg-critical-soft border-critical/40 text-fg",
    privacy: "bg-primary-soft border-primary/30 text-fg",
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-2xl border p-4 text-sm", styles)} role={tone === "danger" ? "alert" : undefined}>
      {icon && <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span>}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn("text-muted", Boolean(title) && "mt-1")}>{children}</div>}
      </div>
    </div>
  );
}
