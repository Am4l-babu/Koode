import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";

export function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (page: number) => string }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1);
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1.5">
      <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </PageLink>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - pages[i - 1]! > 1 && <span className="px-1 text-subtle">…</span>}
          <PageLink href={hrefFor(p)} current={p === page} label={`Page ${p}`}>
            {p}
          </PageLink>
        </span>
      ))}
      <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount} label="Next page">
        <ChevronRight className="h-4 w-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({ href, disabled, current, label, children }: { href: string; disabled?: boolean; current?: boolean; label: string; children: React.ReactNode }) {
  const cls = cn(
    "flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-semibold",
    current ? "bg-primary text-primary-fg" : "text-muted hover:bg-surface-2",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) return <span className={cls} aria-hidden="true">{children}</span>;
  return (
    <Link href={href} className={cls} aria-label={label} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
