import { AppSidebar, DashboardFrame, type SidebarItem } from "@/components/layout/app-sidebar";
import { requirePageUser } from "@/lib/auth/guards";
import { getDictionary } from "@/lib/i18n/server";

export default async function DonorLayout({ children }: { children: React.ReactNode }) {
  const [, t] = await Promise.all([requirePageUser(["DONOR"]), getDictionary()]);
  const items: SidebarItem[] = [
    { href: "/donor", label: t.nav.dashboard, icon: "LayoutDashboard", exact: true },
    { href: "/needs", label: t.nav.browse, icon: "Search" },
    { href: "/donor/donations", label: t.nav.myDonations, icon: "HandHeart" },
    { href: "/donor/profile", label: t.nav.profile, icon: "UserRound" },
  ];
  return <DashboardFrame sidebar={<AppSidebar items={items} heading="Donor" />}>{children}</DashboardFrame>;
}
