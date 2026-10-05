import { BadgeCheck, Lock, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { PRIORITY_LABELS } from "@/lib/descriptors";
import type { Priority } from "@prisma/client";

export function UrgencyBadge({ priority, className }: { priority: Priority | string; className?: string }) {
  const p = priority as Priority;
  const tone = p === "CRITICAL" ? "critical" : p === "HIGH" ? "high" : p === "MEDIUM" ? "medium" : "primary";
  return (
    <Badge tone={tone} className={className}>
      <span className={cn("h-1.5 w-1.5 rounded-full", p === "CRITICAL" ? "bg-critical" : p === "HIGH" ? "bg-high" : p === "MEDIUM" ? "bg-medium" : "bg-primary")} aria-hidden="true" />
      {PRIORITY_LABELS[p] ?? priority}
      <span className="sr-only"> urgency</span>
    </Badge>
  );
}

export function VerificationBadge({ verified = true, label = "Verified" }: { verified?: boolean; label?: string }) {
  if (!verified) return <Badge tone="neutral">Pending verification</Badge>;
  return (
    <Badge tone="success" icon={<BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />}>
      {label}
    </Badge>
  );
}

/** The platform's core trust signal. */
export function PrivacyBadge({ note, compact, className }: { note?: string; compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary-soft px-4 py-3", compact && "py-2", className)}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg">
        <Lock className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-primary-ink">Your identity is protected</p>
        {note && <p className="text-sm text-muted">{note}</p>}
      </div>
    </div>
  );
}

export function AnonymousIdentityBadge({ label, sublabel, kind = "donor" }: { label: string; sublabel?: string; kind?: "donor" | "recipient" }) {
  return (
    <div className="inline-flex items-center gap-3">
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed",
          kind === "donor" ? "border-primary/50 bg-primary-soft text-primary-ink" : "border-secondary/60 bg-secondary-soft text-secondary-ink",
        )}
        aria-hidden="true"
      >
        {kind === "donor" ? <UserRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
      </span>
      <span>
        <span className="block font-semibold text-fg">{label}</span>
        {sublabel && <span className="block text-xs text-muted">{sublabel}</span>}
      </span>
    </div>
  );
}
