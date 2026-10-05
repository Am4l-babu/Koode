"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Film, ImagePlus, X } from "lucide-react";
import { api, ApiError } from "@/lib/client-api";
import { cn } from "@/components/ui/cn";

export const MEDIA_LIMITS = { images: 5, videos: 1, imageBytes: 8 * 1024 * 1024, videoBytes: 25 * 1024 * 1024 } as const;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
export const MEDIA_ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");

const isVideo = (f: File) => VIDEO_TYPES.includes(f.type);
const isImage = (f: File) => IMAGE_TYPES.includes(f.type);

/** First-pass checks for a friendlier experience. The server re-validates everything. */
export function checkMediaFiles(existing: File[], incoming: File[], alreadyUploaded = { images: 0, videos: 0 }) {
  const accepted: File[] = [];
  const problems: string[] = [];
  let images = existing.filter(isImage).length + alreadyUploaded.images;
  let videos = existing.filter(isVideo).length + alreadyUploaded.videos;
  for (const f of incoming) {
    if (isImage(f)) {
      if (f.size > MEDIA_LIMITS.imageBytes) problems.push("Photos must be 8 MB or smaller.");
      else if (images >= MEDIA_LIMITS.images) problems.push(`You can add up to ${MEDIA_LIMITS.images} photos.`);
      else (accepted.push(f), images++);
    } else if (isVideo(f)) {
      if (f.size > MEDIA_LIMITS.videoBytes) problems.push("Videos must be 25 MB or smaller.");
      else if (videos >= MEDIA_LIMITS.videos) problems.push(`You can add ${MEDIA_LIMITS.videos} video.`);
      else (accepted.push(f), videos++);
    } else problems.push("Use JPEG, PNG or WEBP photos, or MP4 or WEBM videos.");
  }
  return { accepted, problems: [...new Set(problems)] };
}

/** Upload one file to a donation. Returns an error message, or null on success. */
export async function uploadDonationMedia(donationId: string, file: File): Promise<string | null> {
  const formData = new FormData();
  formData.set("file", file);
  try {
    await api(`/api/my-donations/${donationId}/media`, { formData });
    return null;
  } catch (e) {
    return e instanceof ApiError ? e.message : "That file couldn't be uploaded.";
  }
}

export function MediaPicker({
  files,
  onChange,
  alreadyUploaded,
  disabled,
  idPrefix = "media",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  alreadyUploaded?: { images: number; videos: number };
  disabled?: boolean;
  idPrefix?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const previews = useMemo(() => files.map((f) => ({ f, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  function add(list: FileList | null) {
    if (!list || list.length === 0) return;
    const { accepted, problems } = checkMediaFiles(files, Array.from(list), alreadyUploaded);
    setProblems(problems);
    if (accepted.length) onChange([...files, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={`${idPrefix}-input`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled) add(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-surface-2 px-4 py-6 text-center transition-colors hover:border-primary hover:bg-primary-soft/50 focus-within:border-primary focus-within:shadow-[var(--ring)]",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <span className="flex gap-2 text-primary-ink" aria-hidden="true">
          <Camera className="h-6 w-6" />
          <Film className="h-6 w-6" />
        </span>
        <span className="font-semibold">Add photos or a short video</span>
        <span className="text-sm text-muted">Up to {MEDIA_LIMITS.images} photos (8 MB each) and {MEDIA_LIMITS.videos} video (25 MB). Drag files here or choose them.</span>
        <input id={`${idPrefix}-input`} ref={inputRef} type="file" multiple accept={MEDIA_ACCEPT} className="sr-only" disabled={disabled} onChange={(e) => add(e.target.files)} />
      </label>

      {problems.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-critical">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}

      {previews.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Selected files">
          {previews.map(({ f, url }, i) => (
            <li key={`${f.name}-${i}`} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-3">
              {isVideo(f) ? (
                <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-label="Video preview" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="Selected photo preview" className="h-full w-full object-cover" />
              )}
              {isVideo(f) && <Film className="absolute bottom-1.5 left-1.5 h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, x) => x !== i))}
                aria-label={`Remove ${isVideo(f) ? "video" : "photo"} ${i + 1}`}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="flex gap-2 text-xs text-muted">
        <ImagePlus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Show the items only. Please avoid faces, name labels, addresses or documents in the frame. Location data is removed from photos automatically, and videos are checked by our team before the organisation sees them.
        </span>
      </p>
    </div>
  );
}
