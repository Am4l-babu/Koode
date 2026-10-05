import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { UrgencyBadge } from "@/components/brand/badges";
import { requirePageUser } from "@/lib/auth/guards";
import { listOwnRequests } from "@/services/requests";
import { REQUEST_STATUS_LABELS } from "@/lib/descriptors";
import { formatDate } from "@/lib/format";

export const metadata = { title: "My requests" };

const TONE: Record<string, "primary" | "success" | "accent" | "critical" | "neutral" | "info"> = {
  ACTIVE: "primary", FULFILLED: "success", PENDING_VERIFICATION: "accent", NEEDS_INFO: "info", REJECTED: "critical", CLOSED: "neutral", DRAFT: "neutral",
};

export default async function MyRequestsPage() {
  const user = await requirePageUser(["RECIPIENT"]);
  const requests = await listOwnRequests(user);
  return (
    <>
      <PageHeader eyebrow="Requests" title="My requests" actions={<ButtonLink href="/recipient/requests/new">Create request</ButtonLink>} />
      {requests.length === 0 ? (
        <EmptyState title="No requests yet" description="Tell donors exactly what you need — sizes, ages and quantities." action={<ButtonLink href="/recipient/requests/new">Create your first request</ButtonLink>} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/recipient/requests/${r.id}`} className="card card-hover block p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TONE[r.status] ?? "neutral"}>{REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS]}</Badge>
                  <UrgencyBadge priority={r.priority} />
                  <span className="ml-auto font-mono text-xs text-subtle">{r.id}</span>
                </div>
                <p className="mt-3 text-lg font-semibold">{r.category.icon} {r.title}</p>
                <ul className="mt-3 space-y-2">
                  {r.items.map((i) => (
                    <li key={i.id} className="text-sm">
                      <div className="flex justify-between"><span>{i.name}</span><span className="text-muted">{i.committed}/{i.required}</span></div>
                      <ProgressBar value={i.percent} size="sm" className="mt-1" label={`${i.name}: ${i.percent}%`} />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted">Created {formatDate(r.postedAt)}{r.neededBy ? ` · needed by ${formatDate(r.neededBy)}` : ""}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
