import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

export function AdminTable({ columns, children, empty }: { columns: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>{columns.map((c) => <th key={c} scope="col" className="px-4 py-3 font-semibold">{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
      {empty && <p className="px-4 py-10 text-center text-muted">Nothing here right now.</p>}
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; key: string; count?: number }[]; active: string }) {
  return (
    <nav aria-label="Filter" className="mb-5 flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", active === t.key ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface hover:border-line-strong")}
        >
          {t.label}
          {t.count !== undefined && <span className="text-xs opacity-75">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function SensitiveBanner() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-critical/40 bg-critical-soft px-4 py-2.5 text-sm font-semibold text-critical" role="note">
      🔒 Sensitive information — Admin access only. This view has been recorded in the audit log.
    </div>
  );
}
