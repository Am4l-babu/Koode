import type { Metadata } from "next";
import { Database, Eye, FileLock2, KeyRound, ScrollText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { Section } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "About",
  description: "Why Koode exists and how it protects the dignity and privacy of everyone involved.",
};

const PRINCIPLES = [
  ["Dignity first", "Requests are presented as community requirements, never as appeals for charity. There are no rankings of need and no photographs of recipients."],
  ["Specific, not generic", "Donors give exactly what is needed: the right size, the right age group and the right quantity."],
  ["Private by design", "Neither side ever sees the other. Koode acts as the trusted intermediary."],
];

const CONTROLS = [
  [Database, "Separated data", "Personal details live in separate, encrypted tables (AES-256-GCM). Public tables hold only anonymous references."],
  [KeyRound, "Least-privilege access", "Admin permissions are granular. Identity access requires a dedicated permission that most staff never hold."],
  [ScrollText, "Audited access", "Every view of private information, every verification and every export writes an append-only audit record."],
  [FileLock2, "Private documents", "Verification documents are stored outside public storage and opened only via short-lived signed links."],
  [Eye, "No leaks in the API", "Donor and recipient endpoints use strict projections that physically cannot include personal fields — tested automatically."],
  [ShieldCheck, "Abuse prevention", "Bot checks, rate limits, duplicate detection, fraud signals and a report button on every request."],
] as const;

export default function AboutPage() {
  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6">
        <PageHeader
          title="A trusted bridge between genuine community needs and the people willing to help"
          description="“Koode” means together. A donor should be able to say “I know exactly what is needed, and I can help without revealing who I am” — and an organisation should be able to say “we can ask for what we need without exposing our private information.”"
        />
        <div className="grid gap-4 md:grid-cols-3">
          {PRINCIPLES.map(([title, body]) => (
            <div key={title} className="card p-6">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
      <Section id="privacy" eyebrow="Privacy promise" title="How we keep identities private" lead="Privacy isn't a screen that hides names — it is enforced at the database, the API and the interface.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map(([Icon, title, body]) => (
            <div key={title} className="card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
