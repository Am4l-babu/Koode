"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, RadioCard, Textarea } from "@/components/ui/form";
import { Callout } from "@/components/ui/states";
import { api, ApiError } from "@/lib/client-api";

const REASONS = [
  ["SUSPICIOUS_INFORMATION", "Suspicious information"],
  ["DUPLICATE_REQUEST", "Duplicate request"],
  ["INCORRECT_REQUIREMENT", "Incorrect requirement"],
  ["MISUSE", "Misuse"],
  ["FAKE_ORGANIZATION", "Fake organisation"],
  ["OTHER", "Other"],
] as const;

export function ReportButton({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("SUSPICIOUS_INFORMATION");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setState("sending");
    setError(null);
    try {
      await api(`/api/requests/${requestId}/report`, { body: { reason, details: details.trim() || undefined } });
      setState("sent");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something didn't go as planned.");
      setState("idle");
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm text-muted hover:text-critical">
        <Flag className="h-4 w-4" aria-hidden="true" /> Report this request
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Report this request" description="Reports go to the platform's trust & safety team. Your identity is not shared." size="sm">
        {state === "sent" ? (
          <Callout tone="success" title="Thank you — we'll review this.">The investigation team has been notified.</Callout>
        ) : (
          <div className="space-y-4">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-semibold">Reason</legend>
              {REASONS.map(([v, l]) => <RadioCard key={v} name="reason" value={v} checked={reason === v} onChange={setReason} title={l} />)}
            </fieldset>
            <Field label="Details (optional)" htmlFor="report-details">
              <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={600} />
            </Field>
            {error && <Callout tone="danger" title={error} />}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={submit} loading={state === "sending"}>Send report</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
