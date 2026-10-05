"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/states";
import { api, ApiError } from "@/lib/client-api";
import type { DonationMediaDTO } from "@/lib/dto/donations";
import { MediaGallery } from "./media-gallery";
import { MediaPicker, uploadDonationMedia } from "./media-picker";

/** Donor-side: see, add and remove photos/videos while the donation is in progress. */
export function DonationMediaManager({ donationId, media, editable }: { donationId: string; media: DonationMediaDTO[]; editable: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = media.filter((m) => m.status !== "REJECTED");

  async function upload() {
    setBusy(true);
    setError(null);
    const failed: string[] = [];
    for (const f of files) {
      const problem = await uploadDonationMedia(donationId, f);
      if (problem) failed.push(problem);
    }
    setBusy(false);
    setFiles([]);
    if (failed.length) setError([...new Set(failed)].join(" "));
    router.refresh();
  }

  async function remove(m: DonationMediaDTO) {
    setDeletingId(m.id);
    setError(null);
    try {
      await api(`/api/my-donations/${donationId}/media/${m.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something didn't go as planned.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {media.length === 0 && <p className="text-sm text-muted">No photos or videos yet. Showing the items helps the organisation prepare.</p>}
      <MediaGallery media={media} showStatus onDelete={editable ? remove : undefined} deletingId={deletingId} />
      {media.some((m) => m.kind === "VIDEO" && m.status === "PENDING") && (
        <p className="text-sm text-muted">Videos are reviewed by our team before the organisation can see them. Photos are shared straight away.</p>
      )}
      {editable && (
        <>
          <MediaPicker
            idPrefix="manage-media"
            files={files}
            onChange={setFiles}
            disabled={busy}
            alreadyUploaded={{ images: current.filter((m) => m.kind === "IMAGE").length, videos: current.filter((m) => m.kind === "VIDEO").length }}
          />
          {files.length > 0 && <Button onClick={upload} loading={busy}>Upload {files.length} {files.length === 1 ? "file" : "files"}</Button>}
        </>
      )}
      {error && <Callout tone="danger" title={error} />}
    </div>
  );
}
