import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { HowItWorksSteps, PrivacyComparison, Section } from "@/components/marketing/sections";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "How it works",
  description: "From a verified request to a delivered donation, with donor and recipient identities kept private at every step.",
};

const FAQ = [
  ["Do I have to donate money?", "No. Koode is built around giving the specific items a verified organisation has asked for. Monetary support may be added later through a compliant payment provider."],
  ["Who can see my name?", "Only a small number of authorised administrators with a dedicated permission can see it, and each access is recorded in an audit log. Organisations see only an anonymous reference."],
  ["How are organisations verified?", "Before an organisation can publish requests, our team reviews its registration, contact person, location, supporting documents, evidence of need and history of activity."],
  ["How do items reach the organisation?", "You choose a platform pickup, a partner drop-off point or courier delivery. Koode coordinates the handover, so neither side needs the other's address."],
  ["What if a need has already been met?", "Quantities update in real time, and the system never accepts more than is needed, even when two people donate at the same moment."],
];

export default async function HowItWorksPage() {
  const t = await getDictionary();
  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6">
        <PageHeader title="A secure, private bridge between need and generosity" description={t.how.lead} />
        <HowItWorksSteps t={t} privacyNote />
      </div>
      <Section id="privacy-model" eyebrow="Privacy model" title="What each side can see">
        <PrivacyComparison />
      </Section>
      <Section id="faq" eyebrow="Questions" title="Frequently asked questions" className="pt-0">
        <div className="grid gap-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card group p-5 open:shadow-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {q}
                <span className="text-xl text-subtle transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 text-muted">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/needs" size="lg">{t.hero.ctaHelp}</ButtonLink>
          <ButtonLink href="/register?role=recipient" size="lg" variant="outline">{t.hero.ctaRequest}</ButtonLink>
        </div>
      </Section>
    </>
  );
}
