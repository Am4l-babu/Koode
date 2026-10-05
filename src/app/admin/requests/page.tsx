import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { UrgencyBadge } from "@/components/brand/badges";
import { AdminTable, Tabs, Td } from "@/components/admin/admin-table";
import { ReportActions } from "@/components/admin/actions";
import { requirePagePermission } from "@/lib/auth/guards";
import { listReports, listRequestsForModeration } from "@/services/admin";
import { REQUEST_STATUS_LABELS } from "@/lib/descriptors";
import { formatDate } from "@/lib/format";
import type { RequestStatus } from "@prisma/client";

export const metadata = { title: "Requests" };
const STATUSES = ["PENDING_VERIFICATION", "NEEDS_INFO", "ACTIVE", "FULFILLED", "REJECTED", "CLOSED"] as const;

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; tab?: string; page?: string }> }) {
  await requirePagePermission("REQUEST_REVIEW");
  const sp = await searchParams;
  const tab = sp.tab === "reports" ? "reports" : sp.status ?? "PENDING_VERIFICATION";
  const tabs = [
    ...STATUSES.map((s) => ({ key: s, label: REQUEST_STATUS_LABELS[s], href: `/admin/requests?status=${s}` })),
    { key: "ALL", label: "All", href: "/admin/requests?status=ALL" },
    { key: "reports", label: "🚩 Reports", href: "/admin/requests?tab=reports" },
  ];

  if (tab === "reports") {
    const reports = await listReports();
    return (
      <>
        <PageHeader eyebrow="Trust & safety" title="Investigation queue" description="Reports submitted by the community." />
        <Tabs tabs={tabs} active="reports" />
        <AdminTable columns={["Request", "Reason", "Details", "Status", "Reported", "Actions"]} empty={!reports.length}>
          {reports.map((r) => (
            <tr key={r.id}>
              <Td><Link href={`/admin/requests/${r.request.id}`} className="font-semibold text-primary-ink hover:underline">{r.request.title}</Link><div className="font-mono text-xs text-subtle">{r.request.publicId}</div></Td>
              <Td>{r.reason.replace(/_/g, " ").toLowerCase()}</Td>
              <Td className="max-w-xs text-muted">{r.details ?? "—"}</Td>
              <Td><Badge tone={r.status === "OPEN" ? "accent" : "info"}>{r.status}</Badge></Td>
              <Td>{formatDate(r.createdAt)}</Td>
              <Td><ReportActions id={r.id} /></Td>
            </tr>
          ))}
        </AdminTable>
      </>
    );
  }

  const page = Number(sp.page) || 1;
  const status = tab === "ALL" ? undefined : (STATUSES as readonly string[]).includes(tab) ? (tab as RequestStatus) : "PENDING_VERIFICATION";
  const data = await listRequestsForModeration(status, page);
  return (
    <>
      <PageHeader eyebrow="Moderation" title="Requests" description="Approve, reject or request more information. Organisation identities remain private here." />
      <Tabs tabs={tabs} active={tab} />
      <AdminTable columns={["Request", "Category", "Partner", "Priority", "Progress", "Created", ""]} empty={!data.rows.length}>
        {data.rows.map((r) => (
          <tr key={r.id}>
            <Td>
              <p className="font-semibold">{r.title}</p>
              <p className="font-mono text-xs text-subtle">{r.publicId}{r.recurrence !== "NONE" ? ` · recurring ${r.recurrence.toLowerCase()}` : ""}{r._count.reports ? ` · 🚩 ${r._count.reports}` : ""}</p>
            </Td>
            <Td>{r.category.icon} {r.category.name}</Td>
            <Td><span className="font-mono text-xs">#{r.organization.publicId}</span><div><Badge tone={r.organization.verificationStatus === "VERIFIED" ? "success" : "accent"}>{r.organization.verificationStatus.toLowerCase()}</Badge></div></Td>
            <Td><UrgencyBadge priority={r.priority} /></Td>
            <Td>{r.percentFulfilled}%</Td>
            <Td>{formatDate(r.createdAt)}</Td>
            <Td><Link href={`/admin/requests/${r.id}`} className="font-semibold text-primary-ink hover:underline">Review →</Link></Td>
          </tr>
        ))}
      </AdminTable>
      <Pagination page={page} pageCount={data.pageCount} hrefFor={(p) => `/admin/requests?status=${tab}&page=${p}`} />
    </>
  );
}
