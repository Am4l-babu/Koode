"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { LayoutGrid, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { cn } from "@/components/ui/cn";
import { CategoryIcon } from "@/components/brand/category-visual";

interface Option {
  value: string;
  label: string;
  icon?: string;
}

export function FilterBar({
  categories,
  districts,
  productTypes = [],
  categoryName,
  interpreted,
}: {
  categories: Option[];
  districts: string[];
  /** Product types with open needs in the selected category. */
  productTypes?: { name: string; count: number }[];
  categoryName?: string;
  interpreted?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    startTransition(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  const active = ["category", "product", "district", "urgency", "stage", "donationType"].filter((k) => params.get(k)).length;
  const product = params.get("product");

  return (
    <div className="space-y-5">
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
            placeholder='Search for needs, e.g. "school bags" or "food near Thrissur"'
            className="h-12 w-full rounded-full border border-line-strong bg-surface pl-12 pr-4 text-base shadow-soft placeholder:text-subtle focus:border-primary focus:outline-none"
          />
        </div>
        <Button type="submit" size="lg" loading={pending} className="h-12 px-6">Search</Button>
      </form>
      {interpreted && (
        <p className="text-sm text-muted" aria-live="polite">
          Showing results for <span className="font-semibold text-fg">{interpreted}</span>
        </p>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Categories">
        <div className="flex min-w-max gap-1.5 sm:min-w-0 sm:flex-wrap">
          <CategoryButton active={!params.get("category")} onClick={() => update({ category: null, product: null })} label="All">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-ink" aria-hidden="true"><LayoutGrid className="h-5 w-5" /></span>
          </CategoryButton>
          {categories.map((c) => (
            <CategoryButton key={c.value} active={params.get("category") === c.value} onClick={() => update({ category: params.get("category") === c.value ? null : c.value, product: null })} label={c.label}>
              <CategoryIcon slug={c.value} emoji={c.icon} />
            </CategoryButton>
          ))}
        </div>
      </div>

      {(productTypes.length > 1 || product) && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${categoryName ?? "Product"} types`}>
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">Product</span>
          <Chip small active={!product} onClick={() => update({ product: null })}>All {categoryName?.toLowerCase() ?? "products"}</Chip>
          {productTypes.map((t) => (
            <Chip small key={t.name} active={product === t.name} onClick={() => update({ product: product === t.name ? null : t.name })}>
              {t.name} <span className={cn("text-xs", product === t.name ? "opacity-80" : "text-muted")}>{t.count}</span>
            </Chip>
          ))}
          {product && !productTypes.some((t) => t.name === product) && <Chip small active onClick={() => update({ product: null })}>{product}</Chip>}
        </div>
      )}

      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <FilterSelect label="Location" id="f-district" value={params.get("district") ?? ""} onChange={(v) => update({ district: v })}
          options={[{ value: "", label: "All locations" }, ...districts.map((d) => ({ value: d, label: d }))]} />
        <FilterSelect label="Urgency" id="f-urgency" value={params.get("urgency") ?? ""} onChange={(v) => update({ urgency: v })}
          options={[{ value: "", label: "Any urgency" }, { value: "CRITICAL", label: "Critical" }, { value: "HIGH", label: "High" }, { value: "MEDIUM", label: "Medium" }, { value: "NORMAL", label: "Normal" }]} />
        <FilterSelect label="Completion" id="f-stage" value={params.get("stage") ?? ""} onChange={(v) => update({ stage: v })}
          options={[{ value: "", label: "Any progress" }, { value: "just_posted", label: "Just posted" }, { value: "partial", label: "Partially fulfilled" }, { value: "almost", label: "Almost complete" }]} />
        <FilterSelect label="Donation type" id="f-type" value={params.get("donationType") ?? ""} onChange={(v) => update({ donationType: v })}
          options={[{ value: "", label: "Any donation type" }, { value: "ITEM", label: "Physical item" }, { value: "MONETARY", label: "Monetary support" }, { value: "SPONSOR", label: "Sponsor entire request" }]} />
        {active > 0 && (
          <button type="button" onClick={() => update({ district: null, urgency: null, stage: null, donationType: null, category: null, product: null, near: null })} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-surface-2">
            <X className="h-4 w-4" aria-hidden="true" /> Clear filters
          </button>
        )}
        <div className="flex gap-2 sm:ml-auto sm:flex-wrap">
          {params.get("sort") === "closest" && (
            <FilterSelect label="Near" id="f-near" value={params.get("near") ?? ""} onChange={(v) => update({ near: v })}
              options={[{ value: "", label: "Choose your district" }, ...districts.map((d) => ({ value: d, label: d }))]} />
          )}
          <FilterSelect label="Sort by" id="f-sort" value={params.get("sort") ?? "urgent"} onChange={(v) => update({ sort: v === "urgent" ? null : v })}
            options={[{ value: "urgent", label: "Most urgent" }, { value: "recent", label: "Recently posted" }, { value: "closest", label: "Closest (needs district)" }, { value: "most_needed", label: "Most needed" }, { value: "almost", label: "Almost fulfilled" }, { value: "popular", label: "Popular" }]} />
        </div>
      </div>
    </div>
  );
}

function CategoryButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-[5.5rem] flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-xs font-semibold transition-colors",
        active ? "border-primary bg-primary-soft text-primary-ink shadow-soft" : "border-transparent text-muted hover:border-line hover:bg-surface",
      )}
    >
      {children}
      <span className="w-full truncate">{label}</span>
    </button>
  );
}

function Chip({ active, onClick, small, children }: { active: boolean; onClick: () => void; small?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border text-sm font-semibold transition-colors",
        small ? "h-10 px-3.5 font-medium" : "h-10 px-4",
        active ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-fg hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}

function FilterSelect({ label, id, value, onChange, options }: { label: string; id: string; value: string; onChange: (v: string | null) => void; options: Option[] }) {
  return (
    <div className="shrink-0">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value || null)} className={cn("h-10 w-auto rounded-full text-sm font-medium", value && "border-primary text-primary-ink")}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </div>
  );
}
