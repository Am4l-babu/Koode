import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { AdminTable, Tabs, Td } from "@/components/admin/admin-table";
import { CreateAdminButton, UserRowActions } from "@/components/admin/actions";
import { requirePagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { listUsers } from "@/services/admin";
import { formatDate } from "@/lib/format";
import type { Role } from "@prisma/client";

export const metadata = { title: "Users" };
const ROLES = ["DONOR", "RECIPIENT", "ADMIN", "SUPER_ADMIN"] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ role?: string; q?: string; page?: string }> }) {
  const user = await requirePagePermission("USER_MANAGEMENT");
  const sp = await searchParams;
  const role = (ROLES as readonly string[]).includes(sp.role ?? "") ? (sp.role as Role) : undefined;
  const page = Number(sp.page) || 1;
  const canSeeIdentity = hasPermission(user, "VIEW_PRIVATE_IDENTITY");
  const data = await listUsers(user, { role, q: sp.q, page });
  return (
    <>
      <PageHeader eyebrow="Users" title="User management" description={canSeeIdentity ? "Emails are masked. Full identities are revealed per user and audited." : "Users are shown by reference only. Identity lookups require the identity permission."} actions={user.role === "SUPER_ADMIN" ? <CreateAdminButton /> : undefined} />
      <form className="mb-4" role="search">
        <label htmlFor="uq" className="sr-only">Search users by reference or email</label>
        <input id="uq" name="q" defaultValue={sp.q} placeholder={canSeeIdentity ? "Search by reference or email" : "Search by reference (e.g. D-7KQ9XM)"} className="h-11 w-full max-w-sm rounded-full border border-line-strong bg-surface px-4 text-sm" />
        {role && <input type="hidden" name="role" value={role} />}
      </form>
      <Tabs active={role ?? "ALL"} tabs={[{ key: "ALL", label: "All", href: "/admin/users" }, ...ROLES.map((r) => ({ key: r, label: r.replace("_", " ").toLowerCase(), href: `/admin/users?role=${r}` }))]} />
      <AdminTable columns={["User", "Role", "Verification", "Status", "Joined", "Actions"]} empty={!data.rows.length}>
        {data.rows.map((u) => (
          <tr key={u.id}>
            <Td><p className="font-mono font-semibold">#{u.publicId}</p>{u.emailMasked && <p className="text-xs text-muted">{u.emailMasked}</p>}</Td>
            <Td><Badge tone={u.role === "SUPER_ADMIN" || u.role === "ADMIN" ? "info" : u.role === "RECIPIENT" ? "success" : "primary"}>{u.role.replace("_", " ").toLowerCase()}</Badge></Td>
            <Td className="text-xs">{u.verification.replace("_", " ").toLowerCase()}</Td>
            <Td><Badge tone={u.status === "ACTIVE" ? "success" : u.status === "SUSPENDED" ? "accent" : "critical"}>{u.status.toLowerCase()}</Badge></Td>
            <Td>{formatDate(u.createdAt)}</Td>
            <Td><UserRowActions user={u} viewer={{ id: user.id, role: user.role, canViewIdentity: canSeeIdentity }} /></Td>
          </tr>
        ))}
      </AdminTable>
      <Pagination page={page} pageCount={data.pageCount} hrefFor={(p) => `/admin/users?${new URLSearchParams({ ...(role ? { role } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
    </>
  );
}
