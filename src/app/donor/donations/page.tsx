import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { StatusPill } from "@/components/donations/tracker";
import { CategoryArt } from "@/components/brand/category-visual";
import { requirePageUser } from "@/lib/auth/guards";
import { listDonorDonations } from "@/services/donations";
import { formatDate, formatINR } from "@/lib/format";

export const metadata = { title: "My donations" };

export default async function MyDonationsPage() {
  const user = await requirePageUser(["DONOR"]);
  const donations = await listDonorDonations(user);
  return (
    <>
      <PageHeader title="My Donations" description="Every donation you have made, and where it is now." />
      {donations.length === 0 ? (
        <EmptyState title="No donations yet" description="Find a verified need that matches what you can give." action={<ButtonLink href="/needs">Browse needs</ButtonLink>} />
      ) : (
        <ul className="grid gap-3">
          {donations.map((d, i) => (
            <li key={d.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
              <Link href={`/donor/donations/${d.id}`} className="card card-hover flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex min-w-0 items-center gap-4">
                  <CategoryArt slug={d.request.category.slug} emoji={d.request.category.icon} size="sm" className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-primary-ink">Donation #{d.id}</p>
                    <p className="truncate font-semibold">{d.items.map((x) => `${x.quantity} × ${x.name}`).join(", ")}</p>
                    <p className="text-sm text-muted">{d.recipient.descriptor} · {d.recipient.district} · {formatDate(d.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {d.estimatedValue ? <span className="text-sm text-muted">{formatINR(d.estimatedValue)}</span> : null}
                  <StatusPill status={d.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
