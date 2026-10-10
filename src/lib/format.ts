const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-IN");

export function formatINR(value: number | null | undefined): string {
  return value == null ? "—" : inr.format(value);
}

export function formatNumber(value: number): string {
  return num.format(value);
}

export function formatDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata", ...opts });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function formatMonthYear(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function relativeDays(value: string | Date | null | undefined, now = new Date()): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  const days = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "Past due";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 30) return `In ${days} days`;
  return null;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** Short countdown for cards: "5 days left", "Due today", "Past due". */
export function daysLeft(value: string | Date | null | undefined, now = new Date()): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  const days = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "Past due";
  if (days === 0) return "Due today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}
