"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  FileClock,
  Gauge,
  HandHeart,
  Inbox,
  LayoutDashboard,
  PanelLeft,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/components/ui/cn";

const ICONS = { LayoutDashboard, Gauge, Search, HandHeart, UserRound, ClipboardList, ClipboardPlus, ClipboardCheck, Inbox, ShieldCheck, Users, Truck, BarChart3, FileClock, Settings } as const;

export type SidebarIcon = keyof typeof ICONS;

export interface SidebarItem {
  href: string;
  label: string;
  icon: SidebarIcon;
  badge?: number;
  /** Match only this exact path (dashboards whose sub-pages have their own items). */
  exact?: boolean;
}

/**
 * Dashboard navigation for signed-in areas. On large screens it is a sticky
 * panel; on phones it opens as a drawer (the bottom tab bar covers the basics).
 */
export function AppSidebar({ items, heading, footer }: { items: SidebarItem[]; heading: string; footer?: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  // The longest matching href wins, so /recipient/requests/new doesn't also light up /recipient/requests.
  const activeHref = items
    .filter((i) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const nav = (
    <nav aria-label={heading} className="flex flex-col gap-1">
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        const active = i.href === activeHref;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.93rem] font-medium transition-colors",
              active ? "bg-primary text-primary-fg shadow-soft" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="h-[1.1rem] w-[1.1rem] shrink-0" aria-hidden="true" />
            <span className="flex-1">{i.label}</span>
            {i.badge ? <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", active ? "bg-white/20" : "bg-accent-soft text-accent-ink")}>{i.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="mb-5 flex items-center justify-between lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold" aria-expanded={open} aria-controls="app-drawer">
          <PanelLeft className="h-4 w-4" aria-hidden="true" /> {heading} menu
        </button>
      </div>
      <aside className="sticky top-24 hidden h-fit w-60 shrink-0 lg:block">
        <div className="card p-3">
          <p className="mb-2 px-3 pt-1 text-xs font-semibold uppercase tracking-wider text-subtle">{heading}</p>
          {nav}
        </div>
        {footer && <div className="mt-4">{footer}</div>}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={`${heading} menu`} id="app-drawer">
          <button type="button" aria-label="Close menu" className="absolute inset-0 animate-fade bg-[rgb(10_20_19/0.5)]" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 animate-rise overflow-y-auto bg-surface p-4 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">{heading}</p>
              <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {footer && <div className="mt-6">{footer}</div>}
          </div>
        </div>
      )}
    </>
  );
}

/** Two-column dashboard frame: sidebar + content. */
export function DashboardFrame({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="lg:flex lg:gap-8">
        {sidebar}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
