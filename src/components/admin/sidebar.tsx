"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, ClipboardCheck, FileClock, Gauge, HandHeart, PanelLeft, Settings, ShieldCheck, Truck, Users, X } from "lucide-react";
import { cn } from "@/components/ui/cn";

const ICONS = { Gauge, ClipboardCheck, HandHeart, Users, ShieldCheck, Truck, BarChart3, FileClock, Settings } as const;

export interface AdminNavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

export function AdminSidebar({ items, roleLabel }: { items: AdminNavItem[]; roleLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.93rem] font-medium transition-colors", active ? "bg-primary text-primary-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            <span className="flex-1">{i.label}</span>
            {i.badge ? <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", active ? "bg-white/20" : "bg-accent-soft text-accent-ink")}>{i.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold" aria-expanded={open} aria-controls="admin-drawer">
          <PanelLeft className="h-4 w-4" aria-hidden="true" /> Admin menu
        </button>
        <span className="text-xs font-semibold uppercase tracking-wider text-subtle">{roleLabel}</span>
      </div>
      <aside className="sticky top-24 hidden h-fit w-60 shrink-0 lg:block">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-subtle">{roleLabel}</p>
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu" id="admin-drawer">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-[rgb(10_20_19/0.5)] animate-fade" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 animate-rise overflow-y-auto bg-surface p-4 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">{roleLabel}</p>
              <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
