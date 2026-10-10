import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { getDictionary } from "@/lib/i18n/server";

export async function Footer() {
  const t = await getDictionary();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-lg font-semibold">{t.brand.name}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">{t.brand.tagline}</p>
        </div>
        <FooterCol title="Give" links={[["/needs", t.nav.browse], ["/needs/education", "Education needs"], ["/needs/clothing", "Clothing needs"], ["/needs/food", "Food needs"]]} />
        <FooterCol title="Organisations" links={[["/register?role=recipient", t.hero.ctaRequest], ["/how-it-works", t.nav.how], ["/login", t.nav.login]]} />
        <FooterCol title="Platform" links={[["/about", t.nav.about], ["/impact", t.nav.impact], ["/about#privacy", t.footer.privacy]]} />
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-subtle sm:px-6">
          © {year} {t.brand.name}. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-muted hover:text-primary-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
