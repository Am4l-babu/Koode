"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { cn } from "@/components/ui/cn";

interface Option {
  value: string;
  label: string;
}

export function FilterBar({
  categories,
  districts,
  interpreted,
}: {
  categories: Option[];
  districts: string[];
  interpreted?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [showMore, setShowMore] = useState(false);

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    startTransition(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  const active = ["category", "district", "urgency", "stage", "donationType"].filter((k) => params.get(k)).length;

  return (
    <div className="space-y-4">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q.trim() || null });
        }}
        className="flex gap-2"
      >
        <label htmlFor="needs-search" className="sr-only">Search needs</label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <input
            id="needs-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Try "school bags for children" or "food near Thrissur"'
            className="h-13 w-full rounded-full border border-line-strong bg-surface pl-12 pr-4 text-base shadow-soft placeholder:text-subtle focus:border-primary focus:outline-none"
          />
        </div>
        <Button type="submit" size="lg" loading={pending} className="h-13 px-6">Search</Button>
      </form>
      {interpreted && (
        <p className="text-sm text-muted" aria-live="polite">
          Showing results for <span className="font-semibold text-fg">{interpreted}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Chip active={!params.get("category")} onClick={() => update({ category: null })}>All</Chip>
        {categories.map((c) => (
          <Chip key={c.value} active={params.get("category") === c.value} onClick={() => update({ category: params.get("category") === c.value ? null : c.value })}>
            {c.label}
          </Chip>
        ))}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-fg hover:border-primary"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> More filters {active > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-fg">{active}</span>}
        </button>
      </div>

      {showMore && (
        <div className="card grid animate-rise gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect label="District" id="f-district" value={params.get("district") ?? ""} onChange={(v) => update({ district: v })}
            options={[{ value: "", label: "All Kerala" }, ...districts.map((d) => ({ value: d, label: d }))]} />
          <FilterSelect label="Urgency" id="f-urgency" value={params.get("urgency") ?? ""} onChange={(v) => update({ urgency: v })}
            options={[{ value: "", label: "Any urgency" }, { value: "CRITICAL", label: "Critical" }, { value: "HIGH", label: "High" }, { value: "MEDIUM", label: "Medium" }, { value: "NORMAL", label: "Normal" }]} />
          <FilterSelect label="Completion" id="f-stage" value={params.get("stage") ?? ""} onChange={(v) => update({ stage: v })}
            options={[{ value: "", label: "Any progress" }, { value: "just_posted", label: "Just posted" }, { value: "partial", label: "Partially fulfilled" }, { value: "almost", label: "Almost complete" }]} />
          <FilterSelect label="Donation type" id="f-type" value={params.get("donationType") ?? ""} onChange={(v) => update({ donationType: v })}
            options={[{ value: "", label: "Any type" }, { value: "ITEM", label: "Physical item" }, { value: "MONETARY", label: "Monetary support" }, { value: "SPONSOR", label: "Sponsor entire request" }]} />
          <FilterSelect label="Sort by" id="f-sort" value={params.get("sort") ?? "urgent"} onChange={(v) => update({ sort: v === "urgent" ? null : v })}
            options={[{ value: "urgent", label: "Most urgent" }, { value: "recent", label: "Recently posted" }, { value: "closest", label: "Closest (needs district)" }, { value: "most_needed", label: "Most needed" }, { value: "almost", label: "Almost fulfilled" }, { value: "popular", label: "Popular" }]} />
          {params.get("sort") === "closest" && (
            <FilterSelect label="Near" id="f-near" value={params.get("near") ?? ""} onChange={(v) => update({ near: v })}
              options={[{ value: "", label: "Choose your district" }, ...districts.map((d) => ({ value: d, label: d }))]} />
          )}
          {active > 0 && (
            <button type="button" onClick={() => update({ district: null, urgency: null, stage: null, donationType: null, category: null, near: null })} className="inline-flex h-11 items-center gap-1.5 self-end rounded-full px-3 text-sm font-semibold text-muted hover:bg-surface-2">
              <X className="h-4 w-4" aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
        active ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-fg hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}

function FilterSelect({ label, id, value, onChange, options }: { label: string; id: string; value: string; onChange: (v: string | null) => void; options: Option[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value || null)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </div>
  );
}
