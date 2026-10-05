"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Gift, Minus, Plus } from "lucide-react";
import type { PublicRequestDTO } from "@/lib/dto/requests";
import { ProgressBar } from "@/components/ui/progress";
import { Button, buttonClass } from "@/components/ui/button";
import { PrivacyBadge } from "@/components/brand/badges";
import { formatNumber } from "@/lib/format";
import { DonationModal } from "./donation-modal";

type Items = PublicRequestDTO["items"];

/**
 * Requirements list with live fulfillment (Server-Sent Events) plus the
 * donation entry point. The SSE channel only ever carries counts.
 */
export function DonatePanel({
  need,
  viewer,
  autoOpen,
}: {
  need: PublicRequestDTO;
  viewer: "guest" | "donor" | "other";
  autoOpen?: boolean;
}) {
  const [items, setItems] = useState<Items>(need.items);
  const [percent, setPercent] = useState(need.percent);
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<{ itemId: string; qty: number } | null>(null);
  const [selectedItem, setSelectedItem] = useState(need.items.find((i) => i.remaining > 0)?.id ?? need.items[0]?.id);
  const [custom, setCustom] = useState(1);

  useEffect(() => {
    if (autoOpen && viewer === "donor" && need.status === "ACTIVE") setOpen(true);
  }, [autoOpen, viewer, need.status]);

  useEffect(() => {
    const es = new EventSource(`/api/requests/${need.id}/stream`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as { percent: number; items: { id: string; committed: number; remaining: number }[] };
      setPercent(data.percent);
      setItems((prev) =>
        prev.map((i) => {
          const u = data.items.find((x) => x.id === i.id);
          return u ? { ...i, committed: u.committed, remaining: u.remaining, percent: Math.round((u.committed / i.required) * 100) } : i;
        }),
      );
    };
    return () => es.close();
  }, [need.id]);

  const current = useMemo(() => items.find((i) => i.id === selectedItem), [items, selectedItem]);
  const accepting = need.status === "ACTIVE" && items.some((i) => i.remaining > 0);

  function start(qty: number) {
    if (!current) return;
    setPreset({ itemId: current.id, qty: Math.min(qty, current.remaining) });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="req-heading" className="card p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="req-heading" className="text-lg font-semibold">Requirements</h2>
          <p className="text-sm text-muted" aria-live="polite">
            <span className="font-semibold text-fg">{percent}%</span> fulfilled
          </p>
        </div>
        <ul className="mt-4 space-y-5">
          {items.map((i) => (
            <li key={i.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-fg">{i.name}</p>
                <p className="text-sm text-muted" aria-live="polite">
                  <span className="font-semibold text-fg">{formatNumber(i.committed)}</span> / {formatNumber(i.required)} {i.unit !== "pcs" ? i.unit : ""} committed
                  {i.remaining > 0 ? <span className="ml-1 text-primary-ink">· {formatNumber(i.remaining)} remaining</span> : <span className="ml-1 text-secondary-ink">· complete ✓</span>}
                </p>
              </div>
              <ProgressBar value={i.percent} size="sm" className="mt-2" tone={i.remaining === 0 ? "success" : "primary"} label={`${i.name}: ${i.percent}% committed`} />
              {Object.keys(i.attributes).length > 0 && (
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {Object.entries(i.attributes).map(([k, v]) => (
                    <div key={k} className="flex gap-1">
                      <dt className="text-subtle">{humanize(k)}:</dt>
                      <dd className="font-medium text-fg">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="donate-heading" className="card p-5 sm:p-6">
        <h2 id="donate-heading" className="text-lg font-semibold">Donation options</h2>
        {!accepting ? (
          <p className="mt-3 text-muted">This need has been fully committed by the community. Thank you! 🌱</p>
        ) : viewer === "guest" ? (
          <div className="mt-3 space-y-3">
            <p className="text-muted">Sign in or create a free donor account to commit items. Your identity stays private.</p>
            <Link href={`/login?next=${encodeURIComponent(`/needs/${need.id}?donate=1`)}`} className={buttonClass("primary", "lg", "w-full")}>
              Sign in to donate
            </Link>
            <Link href={`/register?next=${encodeURIComponent(`/needs/${need.id}?donate=1`)}`} className={buttonClass("outline", "md", "w-full")}>
              Create a donor account
            </Link>
          </div>
        ) : viewer === "other" ? (
          <p className="mt-3 text-muted">Donations are made from donor accounts. Organisation and admin accounts can&apos;t donate.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {items.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="item-pick" className="text-sm font-semibold">Item</label>
                <select id="item-pick" value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)} className="h-11 rounded-xl border border-line-strong bg-surface px-3">
                  {items.map((i) => (
                    <option key={i.id} value={i.id} disabled={i.remaining === 0}>
                      {i.name} — {i.remaining} remaining
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 5].map((n) => (
                <Button key={n} variant="outline" onClick={() => start(n)} disabled={!current || current.remaining < 1 || (n > 1 && current.remaining < n)}>
                  Donate {n}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Custom</span>
              <div className="flex items-center rounded-full border border-line-strong">
                <button type="button" className="flex h-11 w-11 items-center justify-center" aria-label="Decrease quantity" onClick={() => setCustom((c) => Math.max(1, c - 1))}><Minus className="h-4 w-4" /></button>
                <input aria-label="Custom quantity" type="number" min={1} max={current?.remaining ?? 1} value={custom} onChange={(e) => setCustom(Math.max(1, Math.min(Number(e.target.value) || 1, current?.remaining ?? 1)))} className="h-11 w-14 bg-transparent text-center font-semibold focus:outline-none" />
                <button type="button" className="flex h-11 w-11 items-center justify-center" aria-label="Increase quantity" onClick={() => setCustom((c) => Math.min(current?.remaining ?? 1, c + 1))}><Plus className="h-4 w-4" /></button>
              </div>
            </div>
            <Button size="lg" className="w-full" icon={<Gift className="h-5 w-5" aria-hidden="true" />} onClick={() => start(custom)}>
              Commit to Donation
            </Button>
          </div>
        )}
        <PrivacyBadge className="mt-5" note="Your identity will not be shared with the recipient." compact />
      </section>

      {viewer === "donor" && (
        <DonationModal
          open={open}
          onClose={() => setOpen(false)}
          need={{ ...need, items }}
          preset={preset}
          onQuantityConflict={(id, remaining) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, remaining } : i)))}
        />
      )}
    </div>
  );
}

function humanize(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
