import { PageHeader } from "@/components/ui/card";
import { AnonymousIdentityBadge, PrivacyBadge, VerificationBadge } from "@/components/brand/badges";
import { AccountSettings } from "@/components/account/account-settings";
import { requirePageUser } from "@/lib/auth/guards";
import { getOwnOrganization } from "@/services/organizations";
import { db } from "@/lib/db";
import { ORG_TYPE_LABELS } from "@/lib/descriptors";
import { formatMonthYear } from "@/lib/format";

export const metadata = { title: "Organisation profile" };

export default async function RecipientProfilePage() {
  const user = await requirePageUser(["RECIPIENT"]);
  const [org, priv] = await Promise.all([getOwnOrganization(user), db.userPrivate.findUnique({ where: { userId: user.id }, select: { phoneVerifiedAt: true, phoneEnc: true } })]);
  return (
    <>
      <PageHeader eyebrow="Profile" title="Organisation profile" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6" aria-labelledby="pub">
          <h2 id="pub" className="text-lg font-semibold">Public view <span className="text-sm font-normal text-muted">(what donors see)</span></h2>
          <div className="mt-5 rounded-2xl bg-surface-2 p-5">
            <AnonymousIdentityBadge kind="recipient" label={org.publicDescriptor} sublabel={`Verified Community Partner #${org.publicId}`} />
            <dl className="mt-5 grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted">Category</dt><dd className="font-semibold">{org.focusArea ?? ORG_TYPE_LABELS[org.orgType]}</dd>
              <dt className="text-muted">Area</dt><dd className="font-semibold">{org.district} District</dd>
              <dt className="text-muted">Verified</dt><dd>{org.verifiedAt ? <span className="font-semibold">{formatMonthYear(org.verifiedAt)}</span> : <VerificationBadge verified={false} />}</dd>
            </dl>
          </div>
          <PrivacyBadge className="mt-5" note="Your organisation's name, contact person, phone and address are never shown to donors." />
        </section>
        <section className="card p-6" aria-labelledby="priv">
          <h2 id="priv" className="text-lg font-semibold">Private details <span className="text-sm font-normal text-muted">(encrypted · admins only)</span></h2>
          {org.private && (
            <dl className="mt-4 grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted">Registered name</dt><dd>{org.private.legalName}</dd>
              <dt className="text-muted">Contact person</dt><dd>{org.private.contactPerson}</dd>
              <dt className="text-muted">Phone</dt><dd>{org.private.phone}</dd>
              <dt className="text-muted">Address</dt><dd>{org.private.address}{org.private.pinCode ? ` – ${org.private.pinCode}` : ""}</dd>
              <dt className="text-muted">Registration no.</dt><dd>{org.private.registrationNumber ?? "—"}</dd>
              <dt className="text-muted">Login email</dt><dd>{user.email}</dd>
            </dl>
          )}
          <p className="mt-3 text-xs text-muted">To change verified details, contact the platform team so they can be re-verified.</p>
          <div className="mt-6"><AccountSettings emailVerified={user.emailVerified} phoneVerified={Boolean(priv?.phoneVerifiedAt)} hasPhone allowDelete={false} /></div>
        </section>
      </div>
    </>
  );
}
