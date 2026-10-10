import { AppSidebar, DashboardFrame, type SidebarItem } from "@/components/layout/app-sidebar";
import { requirePageUser } from "@/lib/auth/guards";
import { getDictionary } from "@/lib/i18n/server";

export default async function RecipientLayout({ children }: { children: React.ReactNode }) {
  const [, t] = await Promise.all([requirePageUser(["RECIPIENT"]), getDictionary()]);
  const items: SidebarItem[] = [
    { href: "/recipient", label: t.nav.dashboard, icon: "LayoutDashboard", exact: true },
    { href: "/recipient/requests", label: t.nav.myRequests, icon: "ClipboardList" },
    { href: "/recipient/requests/new", label: t.nav.createRequest, icon: "ClipboardPlus" },
    { href: "/recipient/donations", label: t.nav.donations, icon: "Inbox" },
    { href: "/recipient/profile", label: t.nav.orgProfile, icon: "UserRound" },
    { href: "/recipient/verification", label: "Verification", icon: "ShieldCheck" },
  ];
  return <DashboardFrame sidebar={<AppSidebar items={items} heading="Organisation" />}>{children}</DashboardFrame>;
}
