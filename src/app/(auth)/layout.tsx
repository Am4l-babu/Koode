import { LogoMark } from "@/components/brand/logo";
import { PrivacyBadge } from "@/components/brand/badges";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hero-glow">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <aside className="hidden lg:block">
          <LogoMark className="h-14 w-14" />
          <h2 className="mt-6 text-4xl font-semibold leading-tight">Give what is needed.<br />Receive with dignity.<br /><span className="text-primary-ink">Keep identities private.</span></h2>
          <p className="mt-4 max-w-md text-muted">Your personal details are encrypted and are never shown to the other party in a donation.</p>
          <PrivacyBadge className="mt-8 max-w-md" note="Donors and recipients only ever see anonymous references." />
        </aside>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
