import { CheckCircle2, Circle, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/states";
import { VerificationPanel } from "@/components/recipient/verification-panel";
import { requirePageUser } from "@/lib/auth/guards";
import { getOwnOrganization } from "@/services/organizations";
import { VERIFICATION_STATUS_LABELS } from "@/lib/descriptors";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Verification" };

const STATES = ["PENDING", "UNDER_REVIEW", "VERIFIED"] as const;

export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requirePageUser(["RECIPIENT"]);
  const [org, sp] = await Promise.all([getOwnOrganization(user), searchParams]);
  const idx = STATES.indexOf(org.verificationStatus as (typeof STATES)[number]);
  return (
    <>
      <PageHeader title="Organisation verification" description="Verification protects donors and keeps the community trustworthy. Documents are visible only to the verification team." />
      {sp.welcome && <div className="mb-6"><Callout tone="success" title="Welcome! Your application has been received.">Upload at least one supporting document so we can verify your organisation.</Callout></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="card p-6" aria-labelledby="st">
          <h2 id="st" className="text-lg font-semibold">Status</h2>
          <div className="mt-3"><Badge tone={org.verificationStatus === "VERIFIED" ? "success" : org.verificationStatus === "REJECTED" || org.verificationStatus === "SUSPENDED" ? "critical" : "accent"}>{VERIFICATION_STATUS_LABELS[org.verificationStatus]}</Badge></div>
          {idx >= 0 && (
            <ol className="mt-5 space-y-3">
              {STATES.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  {i <= idx ? <CheckCircle2 className="h-5 w-5 text-secondary-ink" aria-hidden="true" /> : <Circle className="h-5 w-5 text-subtle" aria-hidden="true" />}
                  <span className={i <= idx ? "font-semibold" : "text-muted"}>{VERIFICATION_STATUS_LABELS[s]}</span>
                </li>
              ))}
            </ol>
          )}
          {org.verifications[0]?.reviewNote && <div className="mt-5"><Callout tone="info" title="Reviewer note">{org.verifications[0].reviewNote}</Callout></div>}
          <h3 className="mt-6 font-semibold">Documents ({org.documents.length})</h3>
          <ul className="mt-2 space-y-2">
            {org.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-subtle" aria-hidden="true" />
                {d.kind.replace(/_/g, " ").toLowerCase()} · {(d.sizeBytes / 1024).toFixed(0)} KB · {formatDate(d.uploadedAt)}
              </li>
            ))}
            {org.documents.length === 0 && <li className="text-sm text-muted">No documents uploaded yet.</li>}
          </ul>
          <p className="mt-4 text-xs text-muted">What we check: registration, contact person, location, documents, proof of need and previous activity.</p>
        </section>
        <section className="card p-6"><VerificationPanel canSubmit={org.verificationStatus !== "VERIFIED" && org.verificationStatus !== "SUSPENDED"} /></section>
      </div>
    </>
  );
}
