import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PrivacyBadge } from "@/components/brand/badges";
import { RecipientDonationList } from "@/components/recipient/donation-list";
import { requirePageUser } from "@/lib/auth/guards";
import { listRecipientDonations } from "@/services/donations";

export const metadata = { title: "Donations" };

export default async function RecipientDonationsPage() {
  const user = await requirePageUser(["RECIPIENT"]);
  const donations = await listRecipientDonations(user);
  return (
    <>
      <PageHeader eyebrow="Donations" title="Donations received" description="Confirm receipt when items arrive so donors know their gift landed." />
      <PrivacyBadge className="mb-6" note="Donors are shown only as anonymous references unique to your organisation." />
      {donations.length ? <RecipientDonationList donations={donations} /> : <EmptyState illustration="bell" title="No donations yet" description="When donors commit items to your requests they will appear here." />}
    </>
  );
}
