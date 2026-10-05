import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/states";
import { UrgencyBadge } from "@/components/brand/badges";
import { ModerationActions } from "@/components/admin/actions";
import { requirePagePermission } from "@/lib/auth/guards";
import { getModerationDetail } from "@/services/admin";
import { REQUEST_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/descriptors";
import { formatDate } from "@/lib/format";
import { describeAttributes } from "@/lib/categories";
import { AppError } from "@/lib/errors";

export const metadata = { title: "Review request" };

export default async function ModerationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("REQUEST_REVIEW");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getModerationDetail(id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!r) notFound();
  const checks: [string, boolean][] = [
    ["Organisation verified", r.quality.organizationVerified],
    ["Description complete", r.quality.descriptionComplete],
    ["Quantity reasonable", r.quality.quantityReasonable],
    ["Supporting documents present", r.quality.documentsPresent],
    ["No contact details in public text", r.quality.noContactDetails],
    ["No likely duplicates", r.quality.noDuplicates],
  ];
  return (
    <>
      <Link href="/admin/requests" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Requests</Link>
      <PageHeader eyebrow={`${r.category.icon} ${r.category.name} · ${r.publicId}`} title={r.title} actions={<><Badge tone="primary">{REQUEST_STATUS_LABELS[r.status]}</Badge><UrgencyBadge priority={r.priority} /></>} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="card p-6">
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted">Organisation</dt><dd><span className="rounded bg-surface-3 px-1.5 font-mono text-xs">[private]</span> · {r.organization.publicDescriptor} #{r.organization.publicId}</dd>
              <dt className="text-muted">Area</dt><dd>{r.city ? `${r.city}, ` : ""}{r.district}</dd>
              <dt className="text-muted">Needed by</dt><dd>{formatDate(r.neededBy)}</dd>
              <dt className="text-muted">People affected</dt><dd>{r.peopleAffected ?? "—"} <span className="text-xs text-subtle">(internal)</span></dd>
              <dt className="text-muted">Recurrence</dt><dd>{r.recurrence === "NONE" ? "One-time" : r.recurrence.toLowerCase()}</dd>
              <dt className="text-muted">Submitted</dt><dd>{formatDate(r.createdAt)}</dd>
            </dl>
            <h2 className="mt-6 font-semibold">Description</h2>
            <p className="mt-2 whitespace-pre-line text-muted">{r.description}</p>
            <h2 className="mt-6 font-semibold">Requirements</h2>
            <ul className="mt-2 space-y-2">
              {r.items.map((i) => (
                <li key={i.id} className="rounded-xl bg-surface-2 px-4 py-2.5 text-sm">
                  <span className="font-semibold">{i.quantityRequired} {i.unit !== "pcs" ? i.unit : ""} × {i.name}</span> <span className="text-muted">({i.quantityCommitted} committed)</span>
                  {describeAttributes(i.attributes as Record<string, unknown>).length > 0 && <p className="text-xs text-muted">{describeAttributes(i.attributes as Record<string, unknown>).map((a) => `${a.label}: ${a.value}`).join(" · ")}</p>}
                </li>
              ))}
            </ul>
          </section>
          {r.reports.length > 0 && (
            <section className="card p-6">
              <h2 className="font-semibold">🚩 Reports ({r.reports.length})</h2>
              <ul className="mt-3 space-y-2 text-sm">{r.reports.map((rep) => <li key={rep.id}><Badge tone="accent">{rep.status}</Badge> {rep.reason.replace(/_/g, " ").toLowerCase()} — <span className="text-muted">{rep.details ?? "no details"}</span></li>)}</ul>
            </section>
          )}
        </div>
        <div className="space-y-6">
          <section className="card p-6" aria-labelledby="quality">
            <h2 id="quality" className="font-semibold">Request quality</h2>
            <ul className="mt-3 space-y-2">
              {checks.map(([label, ok]) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  {ok ? <CheckCircle2 className="h-4 w-4 text-secondary-ink" aria-hidden="true" /> : <XCircle className="h-4 w-4 text-critical" aria-hidden="true" />}
                  <span className={ok ? "" : "font-semibold text-critical"}>{label}</span><span className="sr-only">{ok ? ": yes" : ": no"}</span>
                </li>
              ))}
            </ul>
            {r.duplicates.length > 0 && <div className="mt-3"><Callout tone="warning" title="Possible duplicates">{r.duplicates.map((d) => `${d.id} — ${d.title}`).join("; ")}</Callout></div>}
            <p className="mt-4 text-sm text-muted">Priority engine suggests <strong className="text-fg">{PRIORITY_LABELS[r.suggestion.priority]}</strong> (internal score {r.suggestion.score}/100). Donors only see the final label.</p>
          </section>
          <section className="card p-6"><ModerationActions id={r.id} status={r.status} priority={r.priority} suggested={r.suggestion.priority} orgVerified={r.quality.organizationVerified} /></section>
        </div>
      </div>
    </>
  );
}
