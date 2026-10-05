/** Horizontal single-hue bars (magnitude). Values are labelled in text ink. */
export function BarChart({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5" aria-label={`${unit} by status`}>
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate text-muted">{d.label}</span>
          <span className="h-5 rounded-r bg-surface-2" title={`${d.label}: ${d.value} ${unit}`}>
            <span className="block h-full rounded-r bg-[var(--chart-1)] transition-[width] duration-700" style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value ? 4 : 0 }} />
          </span>
          <span className="text-right font-semibold tabular-nums text-fg">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}
