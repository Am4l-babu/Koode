import { Backpack, Baby, HandHeart, House, Package, Shirt, Stethoscope, Utensils, Volleyball, type LucideIcon } from "lucide-react";
import { cn } from "@/components/ui/cn";

/**
 * Category look: a line icon and a hue per built-in category. Admin-created
 * categories fall back to their emoji on a neutral tint.
 */
const LOOKS: Record<string, { icon: LucideIcon; hue: string }> = {
  education: { icon: Backpack, hue: "#0f766e" },
  clothing: { icon: Shirt, hue: "#059669" },
  food: { icon: Utensils, hue: "#ea580c" },
  children: { icon: Baby, hue: "#e11d48" },
  "elder-care": { icon: HandHeart, hue: "#7c3aed" },
  "medical-support": { icon: Stethoscope, hue: "#2563eb" },
  household: { icon: House, hue: "#c026d3" },
  sports: { icon: Volleyball, hue: "#ca8a04" },
  other: { icon: Package, hue: "#64748b" },
};
const FALLBACK_HUE = "#64748b";

export function categoryHue(slug: string) {
  return LOOKS[slug]?.hue ?? FALLBACK_HUE;
}

const tint = (hue: string, pct: number) => `color-mix(in oklab, ${hue} ${pct}%, var(--surface))`;
/** The hue nudged toward the text colour so it stays readable in both themes. */
const ink = (hue: string) => `color-mix(in oklab, ${hue} 78%, var(--fg))`;

/** Small tinted icon tile, e.g. in filter chips, lists and the request wizard. */
export function CategoryIcon({ slug, emoji, className, iconClassName }: { slug: string; emoji?: string; className?: string; iconClassName?: string }) {
  const look = LOOKS[slug];
  const hue = look?.hue ?? FALLBACK_HUE;
  return (
    <span
      className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", className)}
      style={{ background: tint(hue, 14), color: ink(hue) }}
      aria-hidden="true"
    >
      {look ? <look.icon className={cn("h-5 w-5", iconClassName)} strokeWidth={1.9} /> : <span className="text-lg leading-none">{emoji ?? "📦"}</span>}
    </span>
  );
}

/**
 * Illustrated header used where a photo would go (need cards, detail banner,
 * donation thumbnails): a soft gradient scene with the category's icon.
 */
export function CategoryArt({ slug, emoji, className, size = "md", children }: { slug: string; emoji?: string; className?: string; size?: "sm" | "md" | "lg"; children?: React.ReactNode }) {
  const look = LOOKS[slug];
  const hue = look?.hue ?? FALLBACK_HUE;
  const iconBox = size === "sm" ? "h-9 w-9 rounded-xl" : size === "lg" ? "h-24 w-24 rounded-[1.75rem]" : "h-16 w-16 rounded-2xl";
  const iconSize = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-12 w-12" : "h-8 w-8";
  return (
    <div
      className={cn("relative isolate flex items-center justify-center overflow-hidden", className)}
      style={{ background: `radial-gradient(120% 90% at 85% 0%, ${tint(hue, 30)}, transparent 60%), linear-gradient(160deg, ${tint(hue, 18)}, ${tint(hue, 7)})` }}
      aria-hidden={children ? undefined : true}
    >
      {size !== "sm" && (
        <>
          <span className="absolute -bottom-10 -left-8 -z-10 h-32 w-32 rounded-full" style={{ background: tint(hue, 22) }} />
          <span className="absolute -right-6 top-6 -z-10 h-16 w-16 rounded-full" style={{ background: tint(hue, 26) }} />
          <svg className="absolute bottom-3 right-6 -z-10 h-10 w-10 opacity-70" viewBox="0 0 40 40" fill="none">
            <path d="M6 34C6 18 18 6 34 6C34 22 22 34 6 34Z" fill={tint(hue, 45)} />
            <path d="M8 32L30 10" stroke={tint(hue, 70)} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="absolute left-[18%] top-[22%] -z-10 h-2 w-2 rounded-full" style={{ background: tint(hue, 55) }} />
          <span className="absolute bottom-[26%] left-[30%] -z-10 h-1.5 w-1.5 rounded-full bg-accent/70" />
        </>
      )}
      <span className={cn("flex items-center justify-center bg-surface shadow-card", iconBox)} style={{ color: ink(hue) }} aria-hidden="true">
        {look ? <look.icon className={iconSize} strokeWidth={1.7} /> : <span className={size === "sm" ? "text-lg" : "text-4xl"}>{emoji ?? "📦"}</span>}
      </span>
      {children}
    </div>
  );
}
