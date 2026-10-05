import Link from "next/link";

/**
 * Logo concept: two community nodes joined by a bridge whose keystone is a
 * privacy shield holding a heart — giving + trust + privacy.
 */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="var(--primary)" />
      <path d="M8 27 C 12 15, 28 15, 32 27" fill="none" stroke="var(--primary-fg)" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
      <circle cx="8.5" cy="27.5" r="3.6" fill="var(--primary-fg)" />
      <circle cx="31.5" cy="27.5" r="3.6" fill="var(--secondary)" />
      <path d="M20 8.5 L26 11 V15.5 C26 19.6 23.4 22.3 20 23.4 C16.6 22.3 14 19.6 14 15.5 V11 Z" fill="var(--primary-fg)" />
      <path d="M20 19.6 C 17.2 17.8 16.6 16.3 17.2 15.2 C 17.8 14.1 19.3 14.2 20 15.3 C 20.7 14.2 22.2 14.1 22.8 15.2 C 23.4 16.3 22.8 17.8 20 19.6 Z" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ name = "Koode" }: { name?: string }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5 rounded-xl" aria-label={`${name} — home`}>
      <LogoMark className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6" />
      <span className="font-display text-lg font-semibold tracking-tight text-fg">{name}</span>
    </Link>
  );
}
