import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { AdminTable, Td } from "@/components/admin/admin-table";
import { requirePagePermission } from "@/lib/auth/guards";
import { listAuditLogs } from "@/services/admin";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Audit logs" };

const SENSITIVE = new Set(["VIEW_PRIVATE_IDENTITY", "VIEW_VERIFICATION_DOCUMENT", "VIEW_DELIVERY_DETAILS", "DATA_EXPORT", "USER_ROLE_CHANGED", "USER_PERMISSIONS_CHANGED"]);

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  await requirePagePermission("AUDIT_LOG_VIEW");
  const sp = await searchParams;
  const action = (AUDIT_ACTIONS as readonly string[]).includes(sp.action ?? "") ? sp.action : undefined;
  const page = Number(sp.page) || 1;
  const data = await listAuditLogs({ action, page });
  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of sensitive actions. IP addresses are stored encrypted." />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor="aa">Action
          <select id="aa" name="action" defaultValue={action ?? ""} className="h-11 rounded-xl border border-line-strong bg-surface px-3 font-normal">
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <button className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg" type="submit">Filter</button>
      </form>
      <AdminTable columns={["When", "Actor", "Action", "Target", "Details", "IP"]} empty={!data.rows.length}>
        {data.rows.map((r) => (
          <tr key={r.id}>
            <Td className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</Td>
            <Td className="font-mono text-xs">{r.actorLabel}</Td>
            <Td><Badge tone={SENSITIVE.has(r.action) ? "critical" : r.action.includes("FAILED") ? "accent" : "neutral"}>{r.action}</Badge></Td>
            <Td className="font-mono text-xs">{r.targetType ? `${r.targetType}:${r.targetId}` : "—"}</Td>
            <Td className="max-w-xs truncate text-xs text-muted">{Object.keys(r.metadata as object).length ? JSON.stringify(r.metadata) : "—"}</Td>
            <Td className="text-xs text-muted">{r.ipStored ? "[stored securely]" : "—"}</Td>
          </tr>
        ))}
      </AdminTable>
      <Pagination page={page} pageCount={data.pageCount} hrefFor={(p) => `/admin/audit-logs?${new URLSearchParams({ ...(action ? { action } : {}), page: String(p) })}`} />
    </>
  );
}
