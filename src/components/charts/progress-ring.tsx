/** Single headline percentage — a ring, not a chart with axes. */
export function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 128 128" className="h-36 w-36" role="img" aria-label={`${label}: ${pct}%`}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="12" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--chart-1)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 64 64)" className="progress-fill" />
        <text x="64" y="70" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--fg)">{pct}%</text>
      </svg>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}
