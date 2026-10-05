"use client";

import { useState } from "react";
import { Clock, Film, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/components/ui/cn";
import type { DonationMediaDTO } from "@/lib/dto/donations";

const STATUS_LABEL: Record<string, string> = { PENDING: "Awaiting review", REJECTED: "Not approved" };

/**
 * Thumbnails for a donation's photos and videos. Files are loaded through the
 * permission-checked /api/media route — there is no public URL.
 */
export function MediaGallery({
  media,
  showStatus,
  onDelete,
  deletingId,
}: {
  media: DonationMediaDTO[];
  showStatus?: boolean;
  onDelete?: (m: DonationMediaDTO) => void;
  deletingId?: string | null;
}) {
  const [open, setOpen] = useState<DonationMediaDTO | null>(null);
  if (media.length === 0) return null;
  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5" aria-label="Photos and videos of the items">
        {media.map((m, i) => {
          const note = showStatus ? STATUS_LABEL[m.status] : undefined;
          return (
            <li key={m.id} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-3">
              <button
                type="button"
                onClick={() => setOpen(m)}
                disabled={m.status === "REJECTED"}
                aria-label={`Open ${m.kind === "VIDEO" ? "video" : "photo"} ${i + 1}`}
                className={cn("block h-full w-full", m.status === "REJECTED" && "cursor-not-allowed opacity-40")}
              >
                {m.kind === "VIDEO" ? (
                  <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={`Photo ${i + 1} of the donated items`} loading="lazy" className="h-full w-full object-cover" />
                )}
                {m.kind === "VIDEO" && <Film className="absolute bottom-1.5 left-1.5 h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
              </button>
              {note && (
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/70 px-1 py-0.5 text-[11px] font-semibold text-white">
                  <Clock className="h-3 w-3" aria-hidden="true" /> {note}
                </span>
              )}
              {onDelete && (
                <button
                  type="button"
                  disabled={deletingId === m.id}
                  onClick={() => onDelete(m)}
                  aria-label={`Remove ${m.kind === "VIDEO" ? "video" : "photo"} ${i + 1}`}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.kind === "VIDEO" ? "Video" : "Photo"} size="lg">
        {open &&
          (open.kind === "VIDEO" ? (
            <video src={open.url} controls playsInline autoPlay className="max-h-[70vh] w-full rounded-xl bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={open.url} alt="Donated items" className="max-h-[70vh] w-full rounded-xl object-contain" />
          ))}
      </Dialog>
    </>
  );
}
