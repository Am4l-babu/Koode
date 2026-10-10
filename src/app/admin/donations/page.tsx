import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { AdminTable, Tabs, Td } from "@/components/admin/admin-table";
import { StatusPill } from "@/components/donations/tracker";
import { requirePagePermission } from "@/lib/auth/guards";
import { listDonationsAdmin } from "@/services/admin";
import { DELIVERY_METHOD_LABELS } from "@/lib/descriptors";
import { formatDate, formatINR } from "@/lib/format";
import type { DonationStatus } from "@prisma/client";

export const metadata = { title: "Donations" };
const STATUSES = ["CONFIRMED", "PREPARING", "IN_TRANSIT", "RECEIVED", "COMPLETED", "CANCELLED"] as const;

export default async function AdminDonationsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requirePagePermission("DONATION_MANAGEMENT");
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as DonationStatus) : undefined;
  const page = Number(sp.page) || 1;
  const data = await listDonationsAdmin({ status, q: sp.q, page });
  return (
    <>
      <PageHeader title="Donation management" description="Public view uses anonymous references only. Identity resolution is a separate, audited action." />
      <form className="mb-4 flex gap-2" role="search">
        <label htmlFor="dq" className="sr-only">Search by donation or request reference</label>
        <input id="dq" name="q" defaultValue={sp.q} placeholder="Search DN-… or NR-…" className="h-11 w-full max-w-sm rounded-full border border-line-strong bg-surface px-4 text-sm" />
        {status && <input type="hidden" name="status" value={status} />}
      </form>
      <Tabs active={status ?? "ALL"} tabs={[{ key: "ALL", label: "All", href: "/admin/donations" }, ...STATUSES.map((s) => ({ key: s, label: s.replace("_", " ").toLowerCase(), href: `/admin/donations?status=${s}` }))]} />
      <AdminTable columns={["Donation", "Donor", "Recipient", "Request", "Qty", "Method", "Status", "Created"]} empty={!data.rows.length}>
        {data.rows.map((d) => (
          <tr key={d.id}>
            <Td><Link href={`/admin/donations/${d.id}`} className="whitespace-nowrap font-mono font-semibold text-primary-ink hover:underline">{d.publicId}</Link></Td>
            <Td className="whitespace-nowrap font-mono text-xs">Donor #{d.donor.publicId}</Td>
            <Td className="whitespace-nowrap font-mono text-xs">Recipient #{d.organization.publicId}</Td>
            <Td><span className="line-clamp-1">{d.request.title}</span></Td>
            <Td>{d.quantity}{d.estimatedValue ? <div className="text-xs text-muted">{formatINR(d.estimatedValue)}</div> : null}</Td>
            <Td className="text-xs">{DELIVERY_METHOD_LABELS[d.deliveryMethod]}</Td>
            <Td><StatusPill status={d.status} /></Td>
            <Td className="whitespace-nowrap">{formatDate(d.createdAt)}</Td>
          </tr>
        ))}
      </AdminTable>
      <Pagination page={page} pageCount={data.pageCount} hrefFor={(p) => `/admin/donations?${new URLSearchParams({ ...(status ? { status } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
    </>
  );
}
