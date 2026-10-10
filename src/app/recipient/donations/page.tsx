import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { RecipientDonationList } from "@/components/recipient/donation-list";
import { requirePageUser } from "@/lib/auth/guards";
import { listRecipientDonations } from "@/services/donations";

export const metadata = { title: "Donations" };

export default async function RecipientDonationsPage() {
  const user = await requirePageUser(["RECIPIENT"]);
  const donations = await listRecipientDonations(user);
  return (
    <>
      <PageHeader title="Donations received" description="Confirm receipt when items arrive so donors know their gift landed." />
      {donations.length ? <RecipientDonationList donations={donations} /> : <EmptyState illustration="bell" title="No donations yet" description="When donors commit items to your requests they will appear here." />}
    </>
  );
}
