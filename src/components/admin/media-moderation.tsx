"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/states";
import { Dialog } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/client-api";

interface AdminMedia {
  id: string;
  kind: "IMAGE" | "VIDEO";
  status: "PENDING" | "APPROVED" | "REJECTED";
  url: string;
  sizeBytes: number;
}

const TONE: Record<AdminMedia["status"], string> = {
  PENDING: "bg-medium-soft text-medium",
  APPROVED: "bg-secondary-soft text-secondary-ink",
  REJECTED: "bg-critical-soft text-critical",
};

/** Moderators check that a file shows only the items, then approve or reject it. */
export function MediaModeration({ media }: { media: AdminMedia[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<AdminMedia | null>(null);

  async function decide(m: AdminMedia, status: "APPROVED" | "REJECTED") {
    setBusy(m.id + status);
    setError(null);
    try {
      await api(`/api/admin/media/${m.id}`, { method: "PATCH", body: { status } });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something didn't go as planned.");
    } finally {
      setBusy(null);
    }
  }

  if (media.length === 0) return <p className="text-sm text-muted">The donor hasn&apos;t attached any photos or videos.</p>;
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {media.map((m, i) => (
          <li key={m.id} className="rounded-2xl border border-line p-3">
            <button type="button" onClick={() => setOpen(m)} aria-label={`Open ${m.kind === "VIDEO" ? "video" : "photo"} ${i + 1}`} className="relative block aspect-video w-full overflow-hidden rounded-xl bg-surface-3">
              {m.kind === "VIDEO" ? (
                <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={`Donor photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
              )}
              {m.kind === "VIDEO" && <Film className="absolute bottom-2 left-2 h-5 w-5 text-white drop-shadow" aria-hidden="true" />}
            </button>
            <div className="mt-2 flex items-center justify-between gap-2 text-sm">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[m.status]}`}>{m.status.toLowerCase()}</span>
              <span className="text-muted">{m.kind === "VIDEO" ? "Video" : "Photo"} · {(m.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
            </div>
            <div className="mt-2 flex gap-2">
              {m.status !== "APPROVED" && <Button size="sm" onClick={() => decide(m, "APPROVED")} loading={busy === m.id + "APPROVED"}>Approve</Button>}
              {m.status !== "REJECTED" && <Button size="sm" variant="outline" onClick={() => decide(m, "REJECTED")} loading={busy === m.id + "REJECTED"}>Reject</Button>}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Approve only files that show the items. Reject anything with faces, names, addresses, documents or other identifying details.</p>
      {error && <Callout tone="danger" title={error} />}
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.kind === "VIDEO" ? "Video" : "Photo"} size="lg">
        {open &&
          (open.kind === "VIDEO" ? (
            <video src={open.url} controls playsInline className="max-h-[70vh] w-full rounded-xl bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={open.url} alt="Donor photo" className="max-h-[70vh] w-full rounded-xl object-contain" />
          ))}
      </Dialog>
    </div>
  );
}
