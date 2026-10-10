import { AppSidebar, DashboardFrame, type SidebarItem } from "@/components/layout/app-sidebar";
import { requirePageUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";

export const metadata = { title: { default: "Admin", template: "%s · Admin · Koode" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(["ADMIN", "SUPER_ADMIN"]);
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(user, p);
  const [pendingReq, pendingVer, openReports] = await Promise.all([
    can("REQUEST_REVIEW") ? db.request.count({ where: { status: "PENDING_VERIFICATION" } }) : 0,
    can("VERIFICATION_REVIEW") ? db.recipientOrganization.count({ where: { verificationStatus: { in: ["PENDING", "UNDER_REVIEW"] } } }) : 0,
    can("REQUEST_REVIEW") ? db.report.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }) : 0,
  ]);
  const items: SidebarItem[] = [
    { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" as const, exact: true },
    ...(can("REQUEST_REVIEW") ? [{ href: "/admin/requests", label: "Requests", icon: "ClipboardCheck" as const, badge: pendingReq + openReports }] : []),
    ...(can("DONATION_MANAGEMENT") ? [{ href: "/admin/donations", label: "Donations", icon: "HandHeart" as const }] : []),
    ...(can("USER_MANAGEMENT") ? [{ href: "/admin/users", label: "Users", icon: "Users" as const }] : []),
    ...(can("VERIFICATION_REVIEW") ? [{ href: "/admin/verifications", label: "Verification", icon: "ShieldCheck" as const, badge: pendingVer }] : []),
    ...(can("DELIVERY_MANAGEMENT") ? [{ href: "/admin/deliveries", label: "Delivery", icon: "Truck" as const }] : []),
    ...(can("ANALYTICS_VIEW") ? [{ href: "/admin/analytics", label: "Analytics", icon: "BarChart3" as const }] : []),
    ...(can("AUDIT_LOG_VIEW") ? [{ href: "/admin/audit-logs", label: "Audit Logs", icon: "FileClock" as const }] : []),
    { href: "/admin/settings", label: "Settings", icon: "Settings" as const },
  ];
  return <DashboardFrame sidebar={<AppSidebar items={items} heading={`${user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"} #${user.publicId}`} />}>{children}</DashboardFrame>;
}
