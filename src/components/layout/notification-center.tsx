"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/components/ui/cn";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationCenter({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [ring, setRing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    const data = await api<{ unread: number; items: NotificationItem[] }>("/api/notifications");
    setItems(data.items);
    setUnread(data.unread);
  }, []);

  // Live unread count via Server-Sent Events.
  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as { unread: number };
      setUnread((prev) => {
        if (data.unread > prev) {
          setRing(true);
          setTimeout(() => setRing(false), 1000);
        }
        return data.unread;
      });
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    if (!open) return;
    load().catch(() => setItems([]));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, load]);

  async function markAll() {
    const data = await api<{ unread: number }>("/api/notifications", { method: "PATCH", body: { all: true } });
    setUnread(data.unread);
    setItems((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
      >
        <Bell className={cn("h-5 w-5", ring && "bell-ring")} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.7rem] font-bold text-[#2a1a00] animate-pop">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-[4.5rem] z-50 animate-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-13 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Notifications</p>
            <button type="button" onClick={markAll} className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-primary-ink hover:bg-primary-soft">
              <CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark all read
            </button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {items === null && <li className="p-4 text-sm text-muted">Loading…</li>}
            {items?.length === 0 && <li className="p-6 text-center text-sm text-muted">You&apos;re all caught up.</li>}
            {items?.map((n) => (
              <li key={n.id} className={cn("border-b border-line last:border-0", !n.readAt && "bg-primary-soft/40")}>
                <Link href={n.link ?? "#"} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-surface-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                    {!n.readAt && <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" />}
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-subtle">{timeAgo(n.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
