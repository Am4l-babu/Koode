import { BadgeCheck, Building2, Search, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
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
const label = (v: string) => v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function verificationTone(v: string): Tone {
  if (v === "VERIFIED" || v === "EMAIL_VERIFIED") return "success";
  if (v === "PENDING" || v === "UNDER_REVIEW") return "accent";
  if (v === "REJECTED") return "critical";
  return "neutral";
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ role?: string; q?: string; page?: string }> }) {
  const user = await requirePagePermission("USER_MANAGEMENT");
  const sp = await searchParams;
  const role = (ROLES as readonly string[]).includes(sp.role ?? "") ? (sp.role as Role) : undefined;
  const page = Number(sp.page) || 1;
  const canSeeIdentity = hasPermission(user, "VIEW_PRIVATE_IDENTITY");
  const data = await listUsers(user, { role, q: sp.q, page });
  return (
    <>
      <PageHeader title="User Management" description={canSeeIdentity ? "Emails are masked. Full identities are revealed per user and audited." : "Users are shown by reference only. Identity lookups require the identity permission."} actions={user.role === "SUPER_ADMIN" ? <CreateAdminButton /> : undefined} />
      <form className="mb-4" role="search">
        <label htmlFor="uq" className="sr-only">Search users by reference or email</label>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <input id="uq" name="q" defaultValue={sp.q} placeholder={canSeeIdentity ? "Search users by reference or email" : "Search by reference (e.g. D-7KQ9XM)"} className="h-11 w-full rounded-full border border-line-strong bg-surface pl-10 pr-4 text-sm" />
        </div>
        {role && <input type="hidden" name="role" value={role} />}
      </form>
      <Tabs active={role ?? "ALL"} tabs={[{ key: "ALL", label: "All", href: "/admin/users" }, ...ROLES.map((r) => ({ key: r, label: label(r), href: `/admin/users?role=${r}` }))]} />
      <AdminTable columns={["User", "Role", "Verification", "Status", "Joined", "Actions"]} empty={!data.rows.length}>
        {data.rows.map((u) => (
          <tr key={u.id}>
            <Td>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink" aria-hidden="true">
                  {u.role === "RECIPIENT" ? <Building2 className="h-4 w-4" /> : u.role === "DONOR" ? <UserRound className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </span>
                <div>
                  <p className="font-mono font-semibold">#{u.publicId}</p>
                  {u.emailMasked && <p className="text-xs text-muted">{u.emailMasked}</p>}
                </div>
              </div>
            </Td>
            <Td>{label(u.role)}</Td>
            <Td><Badge tone={verificationTone(u.verification)} icon={u.verification === "VERIFIED" || u.verification === "EMAIL_VERIFIED" ? <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> : undefined}>{u.verification === "EMAIL_VERIFIED" ? "Verified" : label(u.verification)}</Badge></Td>
            <Td><Badge tone={u.status === "ACTIVE" ? "success" : u.status === "SUSPENDED" ? "accent" : "critical"}>{label(u.status)}</Badge></Td>
            <Td>{formatDate(u.createdAt)}</Td>
            <Td><UserRowActions user={u} viewer={{ id: user.id, role: user.role, canViewIdentity: canSeeIdentity }} /></Td>
          </tr>
        ))}
      </AdminTable>
      <Pagination page={page} pageCount={data.pageCount} hrefFor={(p) => `/admin/users?${new URLSearchParams({ ...(role ? { role } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
    </>
  );
}
