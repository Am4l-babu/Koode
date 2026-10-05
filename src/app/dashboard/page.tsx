import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/guards";

/** Role-based landing — role is resolved server-side from the session. */
export default async function DashboardPage() {
  const user = await requirePageUser();
  if (user.role === "DONOR") redirect("/donor");
  if (user.role === "RECIPIENT") redirect("/recipient");
  redirect("/admin");
}
