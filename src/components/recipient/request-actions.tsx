"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/client-api";

export function RecipientRequestActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"close" | "resubmit" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canClose = ["ACTIVE", "PENDING_VERIFICATION", "NEEDS_INFO", "DRAFT"].includes(status);
  const canResubmit = ["NEEDS_INFO", "DRAFT"].includes(status);
  if (!canClose && !canResubmit) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canResubmit && <Button onClick={() => setConfirm("resubmit")}>{status === "DRAFT" ? "Submit for review" : "Resubmit for review"}</Button>}
      {canClose && <Button variant="ghost" onClick={() => setConfirm("close")}>Close request</Button>}
      {error && <p className="w-full text-sm text-critical" role="alert">{error}</p>}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        loading={busy}
        tone={confirm === "close" ? "danger" : "primary"}
        title={confirm === "close" ? "Close this request?" : "Send for review?"}
        description={confirm === "close" ? "It will no longer accept new donations. Existing donations continue." : "The review team will be notified."}
        confirmLabel={confirm === "close" ? "Close request" : "Submit"}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api(`/api/my-requests/${id}`, { method: "PATCH", body: { action: confirm } });
            setConfirm(null);
            router.refresh();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "Something didn't go as planned.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
