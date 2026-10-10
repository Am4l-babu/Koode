import Link from "next/link";
import { cookies } from "next/headers";
import { Heart, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/guards";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { DesktopLinks, LogoutButton, MobileMenu, MobileTabBar, type NavLink, type TabLink } from "./nav-client";
import { NotificationCenter } from "./notification-center";
import { LocaleSwitcher, ThemeToggle } from "./preferences";

export async function Navbar() {
  const [user, t, locale, store] = await Promise.all([getCurrentUser(), getDictionary(), getLocale(), cookies()]);
  const theme = (store.get("sb_theme")?.value as "light" | "dark" | "system") || "system";

  let links: NavLink[];
  if (!user) {
    links = [
      { href: "/", label: t.nav.home },
      { href: "/needs", label: t.nav.browse },
      { href: "/how-it-works", label: t.nav.how },
      { href: "/about", label: t.nav.about },
      { href: "/impact", label: t.nav.impact },
    ];
  } else if (user.role === "DONOR") {
    links = [
      { href: "/donor", label: t.nav.dashboard },
      { href: "/needs", label: t.nav.browse },
      { href: "/donor/donations", label: t.nav.myDonations },
      { href: "/donor/profile", label: t.nav.profile },
    ];
  } else if (user.role === "RECIPIENT") {
    links = [
      { href: "/recipient", label: t.nav.dashboard },
      { href: "/recipient/requests", label: t.nav.myRequests },
      { href: "/recipient/requests/new", label: t.nav.createRequest },
      { href: "/recipient/donations", label: t.nav.donations },
      { href: "/recipient/profile", label: t.nav.orgProfile },
    ];
  } else {
    links = [
      { href: "/admin", label: t.nav.admin },
      { href: "/needs", label: t.nav.browse },
      { href: "/impact", label: t.nav.impact },
    ];
  }

  const tabs: TabLink[] = !user
    ? [
        { href: "/", label: t.nav.home, icon: "House", exact: true },
        { href: "/needs", label: "Needs", icon: "Search" },
        { href: "/impact", label: t.nav.impact, icon: "Sprout" },
        { href: "/login", label: t.nav.login, icon: "LogIn" },
      ]
    : user.role === "DONOR"
      ? [
          { href: "/donor", label: "Home", icon: "LayoutDashboard", exact: true },
          { href: "/needs", label: "Needs", icon: "Search" },
          { href: "/donor/donations", label: "Donations", icon: "HandHeart" },
          { href: "/donor/profile", label: t.nav.profile, icon: "UserRound" },
        ]
      : user.role === "RECIPIENT"
        ? [
            { href: "/recipient", label: "Home", icon: "LayoutDashboard", exact: true },
            { href: "/recipient/requests", label: "Requests", icon: "ClipboardList" },
            { href: "/recipient/donations", label: "Donations", icon: "Inbox" },
            { href: "/recipient/profile", label: t.nav.profile, icon: "UserRound" },
          ]
        : [
            { href: "/admin", label: "Home", icon: "LayoutDashboard", exact: true },
            { href: "/needs", label: "Needs", icon: "Search" },
            { href: "/admin/analytics", label: "Analytics", icon: "BarChart3" },
            { href: "/impact", label: t.nav.impact, icon: "Sprout" },
          ];
  const profileHref = user?.role === "DONOR" ? "/donor/profile" : user?.role === "RECIPIENT" ? "/recipient/profile" : "/admin/settings";

  const unread = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-xl">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo name={t.brand.name} />
          <DesktopLinks links={links} />
        </div>
        <div className="flex items-center gap-1">
          <div className="hidden items-center sm:flex">
            <LocaleSwitcher locale={locale} />
            <ThemeToggle initial={theme} />
          </div>
          {user ? (
            <>
              <NotificationCenter initialUnread={unread} />
              <LogoutButton label={t.nav.logout} className="hidden lg:flex" />
              <Link href={profileHref} className="ml-1 hidden h-10 w-10 items-center justify-center rounded-full border border-line bg-primary-soft text-primary-ink hover:border-primary sm:flex" aria-label="Your account">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-2 sm:block">
                {t.nav.login}
              </Link>
              <ButtonLink href="/needs" size="sm" className="hidden h-10 sm:inline-flex" icon={<Heart className="h-4 w-4" aria-hidden="true" />}>
                {t.nav.giveNow}
              </ButtonLink>
            </>
          )}
          <MobileMenu
            links={user ? links : [...links, { href: "/login", label: t.nav.login }, { href: "/register", label: t.hero.ctaRequest }]}
            menuLabel={t.nav.menu}
            footer={
              <div className="flex flex-wrap items-center gap-2">
                <LocaleSwitcher locale={locale} />
                <ThemeToggle initial={theme} />
                {user && <LogoutButton label={t.nav.logout} />}
              </div>
            }
          />
        </div>
      </nav>
    </header>
    <MobileTabBar tabs={tabs} />
    </>
  );
}
