"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Callout } from "@/components/ui/states";
import { api, ApiError } from "@/lib/client-api";

export function DonorDonationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function act(action: "PREPARING" | "HANDED_OVER" | "CANCEL") {
    setBusy(action);
    setError(null);
    try {
      await api(`/api/my-donations/${id}`, { method: "PATCH", body: { action } });
      setConfirmCancel(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something didn't go as planned.");
    } finally {
      setBusy(null);
    }
  }

  const canPrepare = status === "CONFIRMED";
  const canHandOver = status === "CONFIRMED" || status === "PREPARING";
  const canCancel = ["CREATED", "CONFIRMED", "PREPARING"].includes(status);
  if (!canPrepare && !canHandOver && !canCancel) return null;

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap gap-2">
        {canPrepare && <Button variant="secondary" onClick={() => act("PREPARING")} loading={busy === "PREPARING"}>Mark as preparing</Button>}
        {canHandOver && <Button onClick={() => act("HANDED_OVER")} loading={busy === "HANDED_OVER"}>Confirm handover</Button>}
        {canCancel && <Button variant="ghost" onClick={() => setConfirmCancel(true)}>Cancel donation</Button>}
      </div>
      {error && <div className="mt-3"><Callout tone="danger" title={error} /></div>}
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => act("CANCEL")}
        loading={busy === "CANCEL"}
        tone="danger"
        title="Cancel this donation?"
        description="The quantity will become available to other donors again."
        confirmLabel="Cancel donation"
      />
    </div>
  );
}
