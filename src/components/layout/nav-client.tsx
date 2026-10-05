"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/components/ui/cn";

export interface NavLink {
  href: string;
  label: string;
}

export function DesktopLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <ul className="hidden items-center gap-1 lg:flex">
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-2 text-[0.93rem] font-medium transition-colors",
                active ? "bg-primary-soft text-primary-ink" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function LogoutButton({ label, className }: { label: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={cn("flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg", className)}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

export function MobileMenu({ links, menuLabel, footer }: { links: NavLink[]; menuLabel: string; footer?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="flex h-11 w-11 items-center justify-center rounded-full text-fg hover:bg-surface-2"
        aria-label={menuLabel}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 animate-fade overflow-y-auto bg-bg px-4 pb-10 pt-4">
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "flex min-h-12 items-center rounded-2xl px-4 text-lg font-medium",
                    pathname.startsWith(l.href) && l.href !== "/" ? "bg-primary-soft text-primary-ink" : "text-fg hover:bg-surface-2",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          {footer && <div className="mt-6 border-t border-line pt-6">{footer}</div>}
        </div>
      )}
    </div>
  );
}
