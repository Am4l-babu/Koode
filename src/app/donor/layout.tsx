import { requirePageUser } from "@/lib/auth/guards";

export default async function DonorLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["DONOR"]);
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</div>;
}
