import Image from "next/image";
import Link from "next/link";

/** Brand mark: two people exchanging a gift inside a heart — giving, trust, community. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return <Image src="/logo.png" alt="" width={256} height={256} priority className={`${className} object-contain`} aria-hidden="true" />;
}

export function Logo({ name = "Koode" }: { name?: string }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5 rounded-xl" aria-label={`${name} — home`}>
      <LogoMark className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6" />
      <span className="font-display text-lg font-semibold tracking-tight text-fg">{name}</span>
    </Link>
  );
}
