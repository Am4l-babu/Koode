"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, Lock, Plus, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Callout } from "@/components/ui/states";
import { api, ApiError } from "@/lib/client-api";
import { PERMISSION_LABELS } from "@/lib/permissions";
import type { Permission } from "@prisma/client";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  async function run<T>(key: string, fn: () => Promise<T>, opts: { success?: string; refresh?: boolean } = {}): Promise<T | undefined> {
    setBusy(key);
    setError(null);
    setSuccess(null);
    try {
      const r = await fn();
      if (opts.success) setSuccess(opts.success);
      if (opts.refresh !== false) router.refresh();
      return r;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something didn't go as planned.");
    } finally {
      setBusy(null);
    }
  }
  const feedback = (
    <>
      {error && <div className="mt-3"><Callout tone="danger" title={error} /></div>}
      {success && <div className="mt-3"><Callout tone="success" title={success} /></div>}
    </>
  );
  return { busy, run, feedback };
}

// ───────────────────────── Request moderation ─────────────────────────

export function ModerationActions({ id, status, priority, suggested, orgVerified }: { id: string; status: string; priority: string; suggested: string; orgVerified: boolean }) {
  const { busy, run, feedback } = useAction();
  const [p, setP] = useState(suggested || priority);
  const [note, setNote] = useState("");
  const send = (body: Record<string, unknown>, key: string, success: string) => run(key, () => api(`/api/admin/requests/${id}`, { method: "PATCH", body }), { success });
  const reviewable = ["PENDING_VERIFICATION", "NEEDS_INFO", "DRAFT"].includes(status);

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Decision</h2>
      <Field label="Final priority (shown to donors)" htmlFor="m-priority">
        <Select id="m-priority" value={p} onChange={(e) => setP(e.target.value)}>
          {["CRITICAL", "HIGH", "MEDIUM", "NORMAL"].map((x) => <option key={x} value={x}>{x[0] + x.slice(1).toLowerCase()}</option>)}
        </Select>
      </Field>
      <Field label="Note / reason" htmlFor="m-note" help="Shared with the organisation for rejections and information requests.">
        <Textarea id="m-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      {reviewable && !orgVerified && <Callout tone="warning" title="Verify the organisation first">Requests can only be approved for verified organisations.</Callout>}
      <div className="flex flex-wrap gap-2">
        {reviewable && (
          <>
            <Button onClick={() => send({ decision: "APPROVE", priority: p, note: note || undefined }, "approve", "Approved — the request is now live.")} loading={busy === "approve"} disabled={!orgVerified}>Approve</Button>
            <Button variant="outline" onClick={() => send({ decision: "REQUEST_INFO", note }, "info", "Information requested.")} loading={busy === "info"} disabled={note.trim().length < 5}>Request more information</Button>
            <Button variant="danger" onClick={() => send({ decision: "REJECT", reason: note }, "reject", "Rejected.")} loading={busy === "reject"} disabled={note.trim().length < 5}>Reject</Button>
          </>
        )}
        {status === "ACTIVE" && (
          <>
            <Button variant="secondary" onClick={() => send({ decision: "SET_PRIORITY", priority: p }, "prio", "Priority updated.")} loading={busy === "prio"}>Update priority</Button>
            <Button variant="ghost" onClick={() => send({ decision: "CLOSE", note: note || undefined }, "close", "Request closed.")} loading={busy === "close"}>Close request</Button>
          </>
        )}
        {status === "FULFILLED" && <Button variant="ghost" onClick={() => send({ decision: "CLOSE", note: note || undefined }, "close", "Request closed.")} loading={busy === "close"}>Close fulfilled request</Button>}
      </div>
      {feedback}
    </div>
  );
}

export function ReportActions({ id }: { id: string }) {
  const { busy, run, feedback } = useAction();
  const set = (status: string) => run(status, () => api(`/api/admin/reports/${id}`, { method: "PATCH", body: { status } }));
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" onClick={() => set("INVESTIGATING")} loading={busy === "INVESTIGATING"}>Investigate</Button>
        <Button size="sm" variant="secondary" onClick={() => set("RESOLVED")} loading={busy === "RESOLVED"}>Resolve</Button>
        <Button size="sm" variant="ghost" onClick={() => set("DISMISSED")} loading={busy === "DISMISSED"}>Dismiss</Button>
      </div>
      {feedback}
    </div>
  );
}

// ───────────────────────── Donations & identity ─────────────────────────

export function DonationStatusActions({ id, status }: { id: string; status: string }) {
  const { busy, run, feedback } = useAction();
  const next: Record<string, string[]> = {
    CREATED: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PREPARING", "IN_TRANSIT", "RECEIVED", "CANCELLED"],
    PREPARING: ["IN_TRANSIT", "RECEIVED", "CANCELLED"],
    IN_TRANSIT: ["RECEIVED"],
    RECEIVED: ["COMPLETED"],
  };
  const options = next[status] ?? [];
  if (!options.length) return <p className="text-sm text-muted">No further status changes available.</p>;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((s) => (
          <Button key={s} size="sm" variant={s === "CANCELLED" ? "ghost" : "outline"} loading={busy === s} onClick={() => run(s, () => api(`/api/admin/donations/${id}`, { method: "PATCH", body: { status: s } }))}>
            Mark {s.replace("_", " ").toLowerCase()}
          </Button>
        ))}
      </div>
      {feedback}
    </div>
  );
}

interface Identity {
  donor: { ref: string; name: string | null; email: string; phone: string | null };
  recipient: { ref: string; organization: string | null; contactPerson: string | null; phone: string | null; address: string | null; email: string };
}

/** Explicit, audited identity resolution. Nothing is fetched until the admin asks. */
export function IdentityReveal({ donationId, allowed }: { donationId: string; allowed: boolean }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [confirm, setConfirm] = useState(false);
  const { busy, run, feedback } = useAction();

  if (!allowed) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm">
        <ShieldOff className="mt-0.5 h-5 w-5 text-subtle" aria-hidden="true" />
        <p className="text-muted">Identity resolution requires the <strong className="text-fg">View private identities</strong> permission. Donor and recipient remain anonymous in this view.</p>
      </div>
    );
  }
  if (!identity) {
    return (
      <div>
        <Button variant="outline" icon={<Eye className="h-4 w-4" />} onClick={() => setConfirm(true)}>Reveal identities</Button>
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          loading={busy === "reveal"}
          title="Reveal private identities?"
          description="This access will be recorded in the audit log with your admin reference, the time and your IP address."
          confirmLabel="Reveal"
          onConfirm={async () => {
            const r = await run("reveal", () => api<Identity>(`/api/admin/donations/${donationId}/identity`), { refresh: false });
            if (r) setIdentity(r);
            setConfirm(false);
          }}
        />
        {feedback}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-critical/40 bg-critical-soft px-4 py-2.5 text-sm font-semibold text-critical" role="note">
        <Lock className="h-4 w-4" aria-hidden="true" /> Sensitive information — Admin access only
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <dl className="rounded-2xl border border-line p-4 text-sm">
          <p className="mb-2 font-semibold">DONOR <span className="font-mono text-xs text-subtle">#{identity.donor.ref}</span></p>
          <dt className="text-muted">Name</dt><dd className="mb-1">{identity.donor.name ?? "—"}</dd>
          <dt className="text-muted">Email</dt><dd className="mb-1">{identity.donor.email}</dd>
          <dt className="text-muted">Phone</dt><dd>{identity.donor.phone ?? "—"}</dd>
        </dl>
        <dl className="rounded-2xl border border-line p-4 text-sm">
          <p className="mb-2 font-semibold">RECIPIENT <span className="font-mono text-xs text-subtle">#{identity.recipient.ref}</span></p>
          <dt className="text-muted">Organisation</dt><dd className="mb-1">{identity.recipient.organization}</dd>
          <dt className="text-muted">Contact person</dt><dd className="mb-1">{identity.recipient.contactPerson}</dd>
          <dt className="text-muted">Phone</dt><dd className="mb-1">{identity.recipient.phone}</dd>
          <dt className="text-muted">Address</dt><dd>{identity.recipient.address}</dd>
        </dl>
      </div>
      <Button variant="ghost" size="sm" onClick={() => setIdentity(null)}>Hide</Button>
    </div>
  );
}

// ───────────────────────── Users ─────────────────────────

export function UserRowActions({
  user,
  viewer,
}: {
  user: { id: string; publicId: string; role: string; status: string; permissions: Permission[] };
  viewer: { id: string; role: string; canViewIdentity: boolean };
}) {
  const { busy, run, feedback } = useAction();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(user.role);
  const [perms, setPerms] = useState<Permission[]>(user.permissions);
  const [activity, setActivity] = useState<{ id: string; action: string; targetId: string | null; createdAt: string }[] | null>(null);
  const [identity, setIdentity] = useState<{ name: string | null; email: string; phone: string | null } | null>(null);
  const isSelf = user.id === viewer.id;
  const targetIsAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const canManage = !isSelf && (!targetIsAdmin || viewer.role === "SUPER_ADMIN");
  const patch = (body: Record<string, unknown>, key: string, success: string) => run(key, () => api(`/api/admin/users/${user.id}`, { method: "PATCH", body }), { success });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Manage</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`User #${user.publicId}`} description={`${user.role} · ${user.status}`}>
        <div className="space-y-5">
          {!canManage && <Callout tone="info" title={isSelf ? "You can't change your own account here." : "Only a super admin can manage administrator accounts."} />}
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {user.status !== "ACTIVE" && <Button size="sm" onClick={() => patch({ status: "ACTIVE" }, "act", "Account reactivated.")} loading={busy === "act"}>Reactivate</Button>}
              {user.status === "ACTIVE" && <Button size="sm" variant="outline" onClick={() => patch({ status: "SUSPENDED" }, "sus", "Account suspended and signed out.")} loading={busy === "sus"}>Suspend</Button>}
              {user.status !== "DISABLED" && <Button size="sm" variant="danger" onClick={() => patch({ status: "DISABLED" }, "dis", "Account disabled.")} loading={busy === "dis"}>Disable</Button>}
              <Button size="sm" variant="ghost" onClick={() => patch({ resetAccess: true }, "reset", "Sessions revoked and a reset link was emailed.")} loading={busy === "reset"}>Reset access</Button>
            </div>
          )}
          {canManage && (
            <div className="rounded-2xl border border-line p-4">
              <Field label="Role" htmlFor={`role-${user.id}`} help={viewer.role === "SUPER_ADMIN" ? "Role changes sign the user out." : "Only super admins can grant admin roles."}>
                <Select id={`role-${user.id}`} value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="DONOR">Donor</option>
                  <option value="RECIPIENT">Recipient</option>
                  {viewer.role === "SUPER_ADMIN" && <option value="ADMIN">Administrator</option>}
                  {viewer.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super Admin</option>}
                </Select>
              </Field>
              <Button size="sm" className="mt-3" disabled={role === user.role} onClick={() => patch({ role }, "role", "Role updated.")} loading={busy === "role"}>Change role</Button>
            </div>
          )}
          {canManage && viewer.role === "SUPER_ADMIN" && user.role === "ADMIN" && (
            <div className="rounded-2xl border border-line p-4">
              <p className="mb-2 text-sm font-semibold">Permissions</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(PERMISSION_LABELS) as Permission[]).filter((p) => p !== "ADMIN_MANAGEMENT" && p !== "SYSTEM_SETTINGS").map((p) => (
                  <Checkbox key={p} label={PERMISSION_LABELS[p]} checked={perms.includes(p)} onChange={(e) => setPerms((cur) => (e.target.checked ? [...cur, p] : cur.filter((x) => x !== p)))} />
                ))}
              </div>
              <Button size="sm" className="mt-3" onClick={() => patch({ permissions: perms }, "perms", "Permissions saved.")} loading={busy === "perms"}>Save permissions</Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={async () => { const r = await run("activity", () => api<typeof activity>(`/api/admin/users/${user.id}`), { refresh: false }); if (r) setActivity(r); }} loading={busy === "activity"}>View activity</Button>
            {viewer.canViewIdentity && !identity && (
              <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={async () => { const r = await run("id", () => api<typeof identity>(`/api/admin/users/${user.id}/identity`), { refresh: false }); if (r) setIdentity(r); }} loading={busy === "id"}>View identity (audited)</Button>
            )}
          </div>
          {identity && (
            <div className="rounded-2xl border border-critical/40 bg-critical-soft/40 p-4 text-sm">
              <p className="mb-2 font-semibold text-critical">🔒 Sensitive information — Admin access only</p>
              <p>Name: {identity.name ?? "—"}</p><p>Email: {identity.email}</p><p>Phone: {identity.phone ?? "—"}</p>
            </div>
          )}
          {activity && (
            <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
              {activity.length === 0 && <li className="text-muted">No recorded activity.</li>}
              {activity.map((a) => <li key={a.id} className="flex justify-between gap-2"><span>{a.action.replace(/_/g, " ").toLowerCase()} {a.targetId && <span className="font-mono text-xs text-subtle">{a.targetId}</span>}</span><span className="text-subtle">{new Date(a.createdAt).toLocaleString("en-IN")}</span></li>)}
            </ul>
          )}
          {feedback}
        </div>
      </Dialog>
    </>
  );
}

export function CreateAdminButton() {
  const { busy, run, feedback } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ email: "", fullName: "", password: "", role: "ADMIN" });
  return (
    <>
      <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Create admin</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Create administrator" description="New admins receive the default permission set; adjust it afterwards." size="sm">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run("create", () => api("/api/admin/users", { body: v }), { success: "Administrator created." }); }}>
          <Field label="Full name" htmlFor="ca-name"><Input id="ca-name" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} /></Field>
          <Field label="Email" htmlFor="ca-email"><Input id="ca-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
          <Field label="Temporary password" htmlFor="ca-pass"><Input id="ca-pass" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></Field>
          <Field label="Role" htmlFor="ca-role"><Select id="ca-role" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}><option value="ADMIN">Administrator</option><option value="SUPER_ADMIN">Super Admin</option></Select></Field>
          <Button type="submit" loading={busy === "create"}>Create</Button>
          {feedback}
        </form>
      </Dialog>
    </>
  );
}

// ───────────────────────── Verification ─────────────────────────

const CHECKLIST = [
  ["registration", "Organisation registration"],
  ["contactPerson", "Contact person"],
  ["location", "Location"],
  ["documents", "Supporting documents"],
  ["proofOfNeed", "Proof of need"],
  ["previousActivity", "Previous activity"],
] as const;

export function VerificationDecision({ orgId, initial }: { orgId: string; initial: Record<string, boolean> }) {
  const { busy, run, feedback } = useAction();
  const [checks, setChecks] = useState<Record<string, boolean>>(initial);
  const [note, setNote] = useState("");
  const decide = (status: string) => run(status, () => api(`/api/admin/verifications/${orgId}`, { method: "PATCH", body: { status, note: note || undefined, checklist: checks } }), { success: `Status set to ${status.replace("_", " ").toLowerCase()}.` });
  const allChecked = CHECKLIST.every(([k]) => checks[k]);
  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Verification checklist</h2>
      <div className="grid gap-2">
        {CHECKLIST.map(([k, l]) => <Checkbox key={k} label={l} checked={!!checks[k]} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} />)}
      </div>
      <Field label="Note to organisation" htmlFor="v-note"><Textarea id="v-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => decide("VERIFIED")} loading={busy === "VERIFIED"} disabled={!allChecked}>Verify</Button>
        <Button variant="outline" onClick={() => decide("UNDER_REVIEW")} loading={busy === "UNDER_REVIEW"}>Mark under review</Button>
        <Button variant="danger" onClick={() => decide("REJECTED")} loading={busy === "REJECTED"}>Reject</Button>
        <Button variant="ghost" onClick={() => decide("SUSPENDED")} loading={busy === "SUSPENDED"}>Suspend</Button>
      </div>
      {!allChecked && <p className="text-xs text-muted">Complete every checklist item to verify.</p>}
      {feedback}
    </div>
  );
}

// ───────────────────────── Deliveries ─────────────────────────

interface Packet {
  donation: string;
  leg: "pickup" | "dropoff";
  items: string[];
  from: { address: string | null; phone?: string | null };
  to: { address: string | null; pinCode?: string | null; area?: string; phone?: string | null };
}

export function DeliveryEditor({ delivery }: { delivery: { id: string; status: string; assigneeLabel: string | null; pickupScheduledAt: string | null; notes: string | null; proofNote: string | null } }) {
  const { busy, run, feedback } = useAction();
  const [open, setOpen] = useState(false);
  const [packet, setPacket] = useState<Packet | null>(null);
  const [v, setV] = useState({
    status: delivery.status,
    assigneeLabel: delivery.assigneeLabel ?? "",
    pickupScheduledAt: delivery.pickupScheduledAt?.slice(0, 16) ?? "",
    notes: delivery.notes ?? "",
    proofNote: delivery.proofNote ?? "",
  });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Update</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delivery coordination">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run("save", () => api(`/api/admin/deliveries/${delivery.id}`, { method: "PATCH", body: { ...v, pickupScheduledAt: v.pickupScheduledAt || undefined, assigneeLabel: v.assigneeLabel || undefined, notes: v.notes || undefined, proofNote: v.proofNote || undefined } }), { success: "Delivery updated." }); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status" htmlFor="d-status"><Select id="d-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>{["UNASSIGNED", "SCHEDULED", "PICKED_UP", "DELIVERED", "FAILED"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}</Select></Field>
            <Field label="Pickup scheduled" htmlFor="d-when"><Input id="d-when" type="datetime-local" value={v.pickupScheduledAt} onChange={(e) => setV({ ...v, pickupScheduledAt: e.target.value })} /></Field>
            <Field label="Volunteer / partner reference" htmlFor="d-who" help="Use a reference, not a personal name."><Input id="d-who" value={v.assigneeLabel} onChange={(e) => setV({ ...v, assigneeLabel: e.target.value })} /></Field>
            <Field label="Proof of delivery" htmlFor="d-proof"><Input id="d-proof" value={v.proofNote} onChange={(e) => setV({ ...v, proofNote: e.target.value })} placeholder="e.g. Signed handover sheet #44" /></Field>
          </div>
          <Field label="Notes" htmlFor="d-notes"><Textarea id="d-notes" rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
          <Button type="submit" loading={busy === "save"}>Save</Button>
        </form>
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <p className="text-xs text-muted">Each leg is revealed separately so no single view links a donor&apos;s location to a recipient&apos;s. Every reveal is audited.</p>
          <div className="flex flex-wrap gap-2">
            {(["pickup", "dropoff"] as const).map((leg) => (
              <Button key={leg} size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} loading={busy === leg} onClick={async () => { const r = await run(leg, () => api<Packet>(`/api/admin/deliveries/${delivery.id}/packet?leg=${leg}`), { refresh: false }); if (r) setPacket(r); }}>
                {leg === "pickup" ? "Pickup leg (donor → hub)" : "Drop-off leg (hub → recipient)"}
              </Button>
            ))}
          </div>
          {packet && (
            <div className="space-y-1 rounded-xl border border-critical/30 p-3 text-sm">
              <p className="font-semibold text-critical">🔒 {packet.leg === "pickup" ? "Pickup" : "Drop-off"} leg — least-privilege view (no names)</p>
              <p><span className="text-muted">Items:</span> {packet.items.join(", ")}</p>
              <p><span className="text-muted">From:</span> {packet.from.address ?? "—"}{packet.from.phone ? ` · ${packet.from.phone}` : ""}</p>
              <p><span className="text-muted">To:</span> {packet.to.address ?? "—"} {packet.to.pinCode ?? ""}{packet.to.area ? ` (${packet.to.area})` : ""}{packet.to.phone ? ` · ${packet.to.phone}` : ""}</p>
            </div>
          )}
        </div>
        {feedback}
      </Dialog>
    </>
  );
}

// ───────────────────────── Settings ─────────────────────────

type Settings = {
  verificationPolicy: { requireDocuments: boolean; minDocuments: number; allowIndividuals: boolean; requirePhoneVerification: boolean };
  retention: { auditLogDays: number; documentDays: number; closedRequestDays: number; deletedAccountGraceDays: number };
  features: { monetaryDonations: boolean; groupDonations: boolean; recurringRequests: boolean; smsNotifications: boolean; whatsappNotifications: boolean };
  security: { sessionDays: number; requireEmailVerificationToDonate: boolean };
};

export function SettingsForm({ initial, canEdit }: { initial: Settings; canEdit: boolean }) {
  const { busy, run, feedback } = useAction();
  const [s, setS] = useState(initial);
  const toggle = <K extends keyof Settings>(section: K, key: keyof Settings[K]) => (e: React.ChangeEvent<HTMLInputElement>) => setS((cur) => ({ ...cur, [section]: { ...cur[section], [key]: e.target.checked } }));
  const num = <K extends keyof Settings>(section: K, key: keyof Settings[K]) => (e: React.ChangeEvent<HTMLInputElement>) => setS((cur) => ({ ...cur, [section]: { ...cur[section], [key]: Number(e.target.value) } }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); run("save", () => api("/api/admin/settings", { method: "PATCH", body: s }), { success: "Settings saved." }); }}>
      <fieldset disabled={!canEdit} className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-3 p-5">
          <legend className="font-semibold">Verification policy</legend>
          <Checkbox label="Require supporting documents" checked={s.verificationPolicy.requireDocuments} onChange={toggle("verificationPolicy", "requireDocuments")} />
          <Checkbox label="Allow individual recipients" checked={s.verificationPolicy.allowIndividuals} onChange={toggle("verificationPolicy", "allowIndividuals")} />
          <Checkbox label="Require phone verification" checked={s.verificationPolicy.requirePhoneVerification} onChange={toggle("verificationPolicy", "requirePhoneVerification")} />
          <Field label="Minimum documents" htmlFor="s-mindocs"><Input id="s-mindocs" type="number" min={0} max={5} value={s.verificationPolicy.minDocuments} onChange={num("verificationPolicy", "minDocuments")} /></Field>
        </div>
        <div className="card space-y-3 p-5">
          <legend className="font-semibold">Data retention (days)</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audit logs" htmlFor="s-audit"><Input id="s-audit" type="number" min={30} value={s.retention.auditLogDays} onChange={num("retention", "auditLogDays")} /></Field>
            <Field label="Documents" htmlFor="s-docs"><Input id="s-docs" type="number" min={30} value={s.retention.documentDays} onChange={num("retention", "documentDays")} /></Field>
            <Field label="Closed requests" htmlFor="s-closed"><Input id="s-closed" type="number" min={30} value={s.retention.closedRequestDays} onChange={num("retention", "closedRequestDays")} /></Field>
            <Field label="Deleted-account grace" htmlFor="s-grace"><Input id="s-grace" type="number" min={0} value={s.retention.deletedAccountGraceDays} onChange={num("retention", "deletedAccountGraceDays")} /></Field>
          </div>
        </div>
        <div className="card space-y-3 p-5">
          <legend className="font-semibold">Features</legend>
          <Checkbox label="Monetary donations (requires a compliant payment provider)" checked={s.features.monetaryDonations} onChange={toggle("features", "monetaryDonations")} />
          <Checkbox label="Group / corporate donations" checked={s.features.groupDonations} onChange={toggle("features", "groupDonations")} />
          <Checkbox label="Recurring requests" checked={s.features.recurringRequests} onChange={toggle("features", "recurringRequests")} />
          <Checkbox label="SMS notifications" checked={s.features.smsNotifications} onChange={toggle("features", "smsNotifications")} />
          <Checkbox label="WhatsApp notifications" checked={s.features.whatsappNotifications} onChange={toggle("features", "whatsappNotifications")} />
        </div>
        <div className="card space-y-3 p-5">
          <legend className="font-semibold">Security</legend>
          <Checkbox label="Require verified email before donating" checked={s.security.requireEmailVerificationToDonate} onChange={toggle("security", "requireEmailVerificationToDonate")} />
          <Field label="Session length (days)" htmlFor="s-sess"><Input id="s-sess" type="number" min={1} max={30} value={s.security.sessionDays} onChange={num("security", "sessionDays")} /></Field>
        </div>
      </fieldset>
      {canEdit ? <Button type="submit" className="mt-5" loading={busy === "save"}>Save settings</Button> : <p className="mt-4 text-sm text-muted">Only super admins can change platform settings.</p>}
      {feedback}
    </form>
  );
}

export function CategoryCreator() {
  const { busy, run, feedback } = useAction();
  const [v, setV] = useState({ slug: "", name: "", icon: "📦", description: "", fields: "size:text\ncondition:select:New|Good" });
  function parseFields() {
    return v.fields.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
      const [key, type = "text", opts] = line.split(":");
      const label = key!.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
      return { key: key!, label, type, ...(opts ? { options: opts.split("|") } : {}) };
    });
  }
  return (
    <form className="card space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); run("cat", () => api("/api/admin/categories", { body: { slug: v.slug, name: v.name, icon: v.icon, description: v.description || undefined, fieldSchema: { fields: parseFields() }, isActive: true, sortOrder: 50 } }), { success: "Category saved. It is now available in the request builder." }); }}>
      <p className="font-semibold">Add or update a category</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Slug" htmlFor="c-slug"><Input id="c-slug" value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} placeholder="hygiene" /></Field>
        <Field label="Name" htmlFor="c-name"><Input id="c-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Hygiene" /></Field>
        <Field label="Icon (emoji)" htmlFor="c-icon"><Input id="c-icon" value={v.icon} onChange={(e) => setV({ ...v, icon: e.target.value })} /></Field>
      </div>
      <Field label="Description" htmlFor="c-desc"><Input id="c-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <Field label="Fields (one per line: key:type[:opt1|opt2])" htmlFor="c-fields" help="Types: text, number, select, boolean, ageRange. This drives the schema-driven request form.">
        <Textarea id="c-fields" rows={4} className="font-mono text-sm" value={v.fields} onChange={(e) => setV({ ...v, fields: e.target.value })} />
      </Field>
      <Button type="submit" loading={busy === "cat"}>Save category</Button>
      {feedback}
    </form>
  );
}

export function DataTools() {
  const { busy, run, feedback } = useAction();
  const [result, setResult] = useState<Record<string, number> | null>(null);
  return (
    <div className="card space-y-3 p-5">
      <p className="font-semibold">Backup & retention</p>
      <p className="text-sm text-muted">Exports contain operational data only — never personal information. Every export is audited.</p>
      <div className="flex flex-wrap gap-2">
        <a href="/api/admin/export" className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-sm font-semibold hover:border-primary">Download export (JSON)</a>
        <Button variant="outline" loading={busy === "ret"} onClick={async () => { const r = await run("ret", () => api<Record<string, number>>("/api/admin/retention", { body: {} })); if (r) setResult(r); }}>Run retention purge now</Button>
      </div>
      {result && <p className="text-sm text-muted">Purged: {Object.entries(result).map(([k, n]) => `${n} ${k}`).join(", ")}</p>}
      {feedback}
    </div>
  );
}
