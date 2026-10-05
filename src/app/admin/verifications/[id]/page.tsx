import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SensitiveBanner } from "@/components/admin/admin-table";
import { VerificationDecision } from "@/components/admin/actions";
import { requirePagePermission } from "@/lib/auth/guards";
import { getVerificationDossier } from "@/services/organizations";
import { AppError } from "@/lib/errors";
import { ORG_TYPE_LABELS, VERIFICATION_STATUS_LABELS } from "@/lib/descriptors";
import { formatDate } from "@/lib/format";
import { headers } from "next/headers";

export const metadata = { title: "Verification dossier" };

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("VERIFICATION_REVIEW");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const o = await getVerificationDossier(user, id, ip).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!o) notFound();
  const latest = o.verifications[0];
  return (
    <>
      <Link href="/admin/verifications" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Verification queue</Link>
      <PageHeader eyebrow={`Partner #${o.publicId}`} title={o.publicDescriptor} actions={<Badge tone={o.verificationStatus === "VERIFIED" ? "success" : "accent"}>{VERIFICATION_STATUS_LABELS[o.verificationStatus]}</Badge>} />
      <div className="mb-6"><SensitiveBanner /></div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-semibold">Organisation</h2>
            {o.private && (
              <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
                <dt className="text-muted">Registered name</dt><dd>{o.private.legalName}</dd>
                <dt className="text-muted">Type</dt><dd>{ORG_TYPE_LABELS[o.orgType]}</dd>
                <dt className="text-muted">Registration no.</dt><dd>{o.private.registrationNumber ?? "—"}</dd>
                <dt className="text-muted">Contact person</dt><dd>{o.private.contactPerson}</dd>
                <dt className="text-muted">Phone</dt><dd>{o.private.phone} {o.private.phoneVerified ? <Badge tone="success">verified</Badge> : null}</dd>
                <dt className="text-muted">Email</dt><dd>{o.private.email} {o.private.emailVerified ? <Badge tone="success">verified</Badge> : null}</dd>
                <dt className="text-muted">Address</dt><dd>{o.private.address} – {o.private.pinCode}</dd>
                <dt className="text-muted">Public area</dt><dd>{o.city ? `${o.city}, ` : ""}{o.district}, {o.state}</dd>
                <dt className="text-muted">Applied</dt><dd>{formatDate(o.createdAt)}</dd>
              </dl>
            )}
            {latest?.applicantNote && <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm"><span className="font-semibold">Applicant note:</span> {latest.applicantNote}</p>}
          </section>
          <section className="card p-6">
            <h2 className="font-semibold">Documents</h2>
            <p className="text-xs text-muted">Links are signed and expire in 5 minutes. Each opening is audited.</p>
            <ul className="mt-3 space-y-2">
              {o.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-subtle" aria-hidden="true" /> {d.kind.replace(/_/g, " ").toLowerCase()} — {d.name}</span>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-ink hover:underline">Open</a>
                </li>
              ))}
              {o.documents.length === 0 && <li className="text-sm text-muted">No documents uploaded.</li>}
            </ul>
          </section>
          <section className="card p-6">
            <h2 className="font-semibold">Previous activity</h2>
            <p className="mt-2 text-sm text-muted">{o.previousActivity.requests} requests · {o.previousActivity.fulfilled} fulfilled · {o.previousActivity.donations} donations received</p>
          </section>
        </div>
        <section className="card h-fit p-6"><VerificationDecision orgId={o.id} initial={(latest?.checklist as Record<string, boolean>) ?? {}} /></section>
      </div>
    </>
  );
}
