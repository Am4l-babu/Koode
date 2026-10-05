"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/client-api";

export function ReceiveButton({ donationId }: { donationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button size="sm" variant="secondary" icon={<PackageCheck className="h-4 w-4" />} onClick={() => setOpen(true)}>Confirm receipt</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={busy}
        title={`Confirm receipt of ${donationId}?`}
        description="The anonymous donor will be told their donation arrived."
        confirmLabel="Yes, received"
        onConfirm={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/recipient/donations/${donationId}/receive`, { body: {} });
            setOpen(false);
            router.refresh();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "Something didn't go as planned.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && <p className="text-sm text-critical" role="alert">{error}</p>}
      </ConfirmDialog>
    </>
  );
}
