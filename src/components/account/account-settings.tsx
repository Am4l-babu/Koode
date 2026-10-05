"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MailCheck, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { Callout } from "@/components/ui/states";
import { api, ApiError } from "@/lib/client-api";

export function AccountSettings({ emailVerified, phoneVerified, hasPhone, allowDelete = true }: { emailVerified: boolean; phoneVerified: boolean; hasPhone: boolean; allowDelete?: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(key: string, fn: () => Promise<{ message?: string } | unknown>, after?: () => void) {
    setBusy(key);
    setMsg(null);
    try {
      const r = (await fn()) as { message?: string };
      if (r?.message) setMsg({ tone: "success", text: r.message });
      after?.();
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof ApiError ? e.message : "Something didn't go as planned." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4">
        <div className="flex items-center gap-3">
          <MailCheck className="h-5 w-5 text-primary-ink" aria-hidden="true" />
          <div><p className="font-semibold">Email verification</p><p className="text-sm text-muted">{emailVerified ? "Verified ✓" : "Not yet verified"}</p></div>
        </div>
        {!emailVerified && <Button variant="outline" size="sm" loading={busy === "email"} onClick={() => run("email", () => api("/api/auth/verify-email", { body: { resend: true } }))}>Resend link</Button>}
      </div>

      <div className="rounded-2xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-primary-ink" aria-hidden="true" />
            <div><p className="font-semibold">Phone verification</p><p className="text-sm text-muted">{phoneVerified ? "Verified ✓" : hasPhone ? "Not yet verified" : "No phone on file"}</p></div>
          </div>
          {!phoneVerified && hasPhone && !otpSent && <Button variant="outline" size="sm" loading={busy === "otp"} onClick={() => run("otp", () => api("/api/auth/phone/send", { body: {} }), () => setOtpSent(true))}>Send code</Button>}
        </div>
        {otpSent && !phoneVerified && (
          <form className="mt-4 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); run("verify", () => api("/api/auth/phone/verify", { body: { code } }), () => router.refresh()); }}>
            <Field label="6-digit code" htmlFor="otp" className="flex-1"><Input id="otp" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <Button type="submit" loading={busy === "verify"}>Verify</Button>
          </form>
        )}
      </div>

      {msg && <Callout tone={msg.tone} title={msg.text} />}

      {allowDelete && (
        <div className="rounded-2xl border border-critical/30 p-4">
          <p className="font-semibold">Delete account</p>
          <p className="mt-1 text-sm text-muted">Your personal details are erased and you are signed out. Past donations stay as anonymous records so recipients&apos; histories remain accurate.</p>
          <Button variant="ghost" className="mt-3 text-critical" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>Delete my account</Button>
          <ConfirmDialog
            open={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            tone="danger"
            title="Delete your account?"
            description="This cannot be undone."
            confirmLabel="Delete permanently"
            loading={busy === "delete"}
            onConfirm={() => run("delete", () => api("/api/me", { method: "DELETE" }), () => { router.push("/"); router.refresh(); })}
          />
        </div>
      )}
    </div>
  );
}
