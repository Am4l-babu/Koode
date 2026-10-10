import { HeroVisual } from "@/components/brand/hero-visual";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hero-glow">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <aside className="hidden lg:block">
          <h2 className="text-4xl font-semibold leading-tight">Give what matters.<br /><span className="text-primary-ink">Receive with dignity.</span></h2>
          <p className="mt-4 max-w-md text-muted">Verified organisations post exactly what they need. Donors give it, and Koode coordinates the rest.</p>
          <div className="mt-6 max-w-sm"><HeroVisual /></div>
        </aside>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
