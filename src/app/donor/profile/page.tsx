import { PageHeader } from "@/components/ui/card";
import { AnonymousIdentityBadge, PrivacyBadge } from "@/components/brand/badges";
import { AccountSettings } from "@/components/account/account-settings";
import { requirePageUser } from "@/lib/auth/guards";
import { donorImpact } from "@/services/donations";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { mask } from "@/lib/notifications/channels";

export const metadata = { title: "Profile" };

export default async function DonorProfilePage() {
  const user = await requirePageUser(["DONOR"]);
  const [impact, priv, profile] = await Promise.all([
    donorImpact(user),
    db.userPrivate.findUnique({ where: { userId: user.id }, select: { fullNameEnc: true, phoneEnc: true, phoneVerifiedAt: true } }),
    db.donorProfile.findUnique({ where: { userId: user.id }, select: { preferredDistrict: true } }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Profile" title="Your profile" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6" aria-labelledby="public">
          <h2 id="public" className="text-lg font-semibold">What others can see</h2>
          <div className="mt-5 rounded-2xl bg-surface-2 p-5">
            <AnonymousIdentityBadge label="Community Donor" sublabel="Anonymous profile" />
            <dl className="mt-5 grid grid-cols-2 gap-4">
              <div><dt className="text-sm text-muted">Requests supported</dt><dd className="font-display text-3xl font-semibold">{impact.requests}</dd></div>
              <div><dt className="text-sm text-muted">Items contributed</dt><dd className="font-display text-3xl font-semibold">{impact.items}</dd></div>
            </dl>
          </div>
          <PrivacyBadge className="mt-5" note="Recipients see only an anonymous reference unique to their organisation." />
        </section>
        <section className="card p-6" aria-labelledby="private">
          <h2 id="private" className="text-lg font-semibold">Private details <span className="text-sm font-normal text-muted">(only you and authorised admins)</span></h2>
          <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Name</dt><dd>{priv ? decrypt(priv.fullNameEnc) : "—"}</dd>
            <dt className="text-muted">Email</dt><dd>{user.email}</dd>
            <dt className="text-muted">Phone</dt><dd>{priv?.phoneEnc ? mask(decrypt(priv.phoneEnc)) : "—"}</dd>
            <dt className="text-muted">District</dt><dd>{profile?.preferredDistrict ?? "—"}</dd>
            <dt className="text-muted">Reference</dt><dd className="font-mono">{user.publicId}</dd>
          </dl>
          <div className="mt-6"><AccountSettings emailVerified={user.emailVerified} phoneVerified={Boolean(priv?.phoneVerifiedAt)} hasPhone={Boolean(priv?.phoneEnc)} /></div>
        </section>
      </div>
    </>
  );
}
