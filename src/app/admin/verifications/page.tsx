import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminTable, Tabs, Td } from "@/components/admin/admin-table";
import { requirePagePermission } from "@/lib/auth/guards";
import { listVerificationQueue } from "@/services/organizations";
import { ORG_TYPE_LABELS, VERIFICATION_STATUS_LABELS } from "@/lib/descriptors";
import { formatDate } from "@/lib/format";
import type { VerificationStatus } from "@prisma/client";

export const metadata = { title: "Verification" };
const STATUSES = ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"] as const;

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePagePermission("VERIFICATION_REVIEW");
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "PENDING") ? ((sp.status ?? "PENDING") as VerificationStatus) : "PENDING";
  const rows = await listVerificationQueue(status);
  return (
    <>
      <PageHeader eyebrow="Trust" title="Recipient verification" description="Review organisations before they can publish requests." />
      <Tabs active={status} tabs={STATUSES.map((s) => ({ key: s, label: VERIFICATION_STATUS_LABELS[s], href: `/admin/verifications?status=${s}` }))} />
      <AdminTable columns={["Partner", "Type", "Area", "Documents", "Status", "Submitted", ""]} empty={!rows.length}>
        {rows.map((o) => (
          <tr key={o.id}>
            <Td><p className="font-mono font-semibold">#{o.publicId}</p><p className="text-xs text-muted">{o.publicDescriptor}</p></Td>
            <Td>{ORG_TYPE_LABELS[o.orgType]}</Td>
            <Td>{o.city ? `${o.city}, ` : ""}{o.district}</Td>
            <Td>{o._count.documents}</Td>
            <Td><Badge tone={o.verificationStatus === "VERIFIED" ? "success" : o.verificationStatus === "PENDING" ? "accent" : "info"}>{VERIFICATION_STATUS_LABELS[o.verificationStatus]}</Badge></Td>
            <Td>{formatDate(o.lastSubmittedAt ?? o.createdAt)}</Td>
            <Td><Link href={`/admin/verifications/${o.id}`} className="font-semibold text-primary-ink hover:underline">Review →</Link></Td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
