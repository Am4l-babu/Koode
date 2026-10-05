import Link from "next/link";
import { ArrowRight, Check, ClipboardList, Gift, PackageCheck, Search, ShieldCheck, X } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/components/ui/cn";

export function HowItWorksSteps({ t, compact }: { t: Dictionary; compact?: boolean }) {
  const steps = [
    { n: "01", title: t.how.s1t, body: t.how.s1d, icon: ClipboardList },
    { n: "02", title: t.how.s2t, body: t.how.s2d, icon: Search },
    { n: "03", title: t.how.s3t, body: t.how.s3d, icon: Gift },
    { n: "04", title: t.how.s4t, body: t.how.s4d, icon: PackageCheck },
  ];
  return (
    <div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.n} className="card relative animate-rise p-6" style={{ animationDelay: `${i * 90}ms` }}>
            <div className="flex items-center justify-between">
              <span className="font-display text-4xl font-bold text-primary/25">{s.n}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink">
                <s.icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
            <p className={cn("mt-1.5 text-muted", compact && "text-sm")}>{s.body}</p>
            {i < steps.length - 1 && (
              <ArrowRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 rounded-full bg-bg p-1 text-subtle lg:block" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
      <p className="mt-6 flex items-center justify-center gap-2 text-center font-semibold text-primary-ink">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" /> {t.how.privacy}
      </p>
    </div>
  );
}

export function PrivacyComparison() {
  const donorSees = ["Exactly what is needed, including sizes and quantities", "The type of organisation, e.g. “Verified Learning Center”", "District or city only", "Urgency and delivery options"];
  const donorNever = ["Names or contact persons", "Phone numbers, email addresses or social media", "Exact addresses", "Verification documents"];
  const recipientSees = ["Items, quantities and condition", "Expected delivery date", "An anonymous reference, e.g. “Community Donor #D7K2Q”"];
  const recipientNever = ["Donor name or photograph", "Phone number, email address or address", "Any identifying information"];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Column title="What donors see" accent="primary" sees={donorSees} never={donorNever} />
      <Column title="What recipients see" accent="secondary" sees={recipientSees} never={recipientNever} />
    </div>
  );
}

function Column({ title, sees, never, accent }: { title: string; sees: string[]; never: string[]; accent: "primary" | "secondary" }) {
  return (
    <div className="card p-6">
      <h3 className={cn("text-lg font-semibold", accent === "primary" ? "text-primary-ink" : "text-secondary-ink")}>{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {sees.map((s) => (
          <li key={s} className="flex gap-2.5 text-sm text-fg">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary-ink" aria-hidden="true" /> {s}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-subtle">Never disclosed</p>
      <ul className="mt-2 space-y-2.5">
        {never.map((s) => (
          <li key={s} className="flex gap-2.5 text-sm text-muted">
            <X className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" /> <span><span className="sr-only">Not shown: </span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CategoryTile({ slug, name, icon, count }: { slug: string; name: string; icon: string; count: number }) {
  return (
    <Link href={`/needs/${slug}`} className="card card-hover group flex items-center gap-3 p-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-2xl transition-transform group-hover:scale-110" aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="block font-semibold text-fg">{name}</span>
        <span className="block text-sm text-muted">{count} active need{count === 1 ? "" : "s"}</span>
      </span>
    </Link>
  );
}

export function Section({ id, eyebrow, title, lead, children, className }: { id?: string; eyebrow?: string; title: string; lead?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("mx-auto max-w-7xl px-4 py-16 sm:px-6", className)}>
      <div className="mb-10 max-w-2xl">
        {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary-ink">{eyebrow}</p>}
        <h2 id={id ? `${id}-title` : undefined} className="text-3xl font-semibold sm:text-4xl">{title}</h2>
        {lead && <p className="mt-3 text-lg text-muted">{lead}</p>}
      </div>
      {children}
    </section>
  );
}
