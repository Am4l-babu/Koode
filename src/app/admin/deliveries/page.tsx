import { PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminTable, Tabs, Td } from "@/components/admin/admin-table";
import { DeliveryEditor } from "@/components/admin/actions";
import { StatusPill } from "@/components/donations/tracker";
import { requirePagePermission } from "@/lib/auth/guards";
import { listDeliveries } from "@/services/admin";
import { DELIVERY_METHOD_LABELS } from "@/lib/descriptors";
import { formatDateTime } from "@/lib/format";
import { trackingInfo } from "@/lib/couriers";

export const metadata = { title: "Delivery" };
const STATUSES = ["UNASSIGNED", "SCHEDULED", "PICKED_UP", "DELIVERED", "FAILED"] as const;

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePagePermission("DELIVERY_MANAGEMENT");
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined;
  const rows = await listDeliveries(status);
  return (
    <>
      <PageHeader title="Delivery coordination" description="Least privilege: logistics staff see only the addresses needed to move items — never names." />
      <Tabs active={status ?? "OPEN"} tabs={[{ key: "OPEN", label: "Open", href: "/admin/deliveries" }, ...STATUSES.map((s) => ({ key: s, label: s.replace("_", " ").toLowerCase(), href: `/admin/deliveries?status=${s}` }))]} />
      <AdminTable columns={["Donation", "Items", "Method", "District", "Delivery", "Donation status", "Scheduled", ""]} empty={!rows.length}>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td className="whitespace-nowrap font-mono font-semibold">{r.donation.publicId}</Td>
            <Td>{r.donation.items.map((i) => `${i.quantity} × ${i.requestItem.name}`).join(", ")}</Td>
            <Td className="text-xs">{DELIVERY_METHOD_LABELS[r.donation.deliveryMethod]}</Td>
            <Td>{r.donation.request.district}</Td>
            <Td><Badge tone={r.status === "DELIVERED" ? "success" : r.status === "FAILED" ? "critical" : r.status === "UNASSIGNED" ? "accent" : "info"}>{r.status.replace("_", " ").toLowerCase()}</Badge>{r.assigneeLabel && <div className="text-xs text-muted">{r.assigneeLabel}</div>}{trackingInfo(r) && <div className="text-xs text-muted">{trackingInfo(r)!.courierName} · <span className="font-mono">{r.trackingNumber}</span></div>}</Td>
            <Td><StatusPill status={r.donation.status} /></Td>
            <Td className="text-xs">{formatDateTime(r.pickupScheduledAt)}</Td>
            <Td><DeliveryEditor delivery={r} /></Td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
