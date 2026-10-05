import { DISTRICT_TILES, KERALA_DISTRICTS } from "@/lib/geo";

/**
 * Privacy-preserving geographic view: a tile map of Kerala's districts
 * (north → south), shaded by a single-hue sequential ramp. No coordinates.
 */
export function DistrictTileMap({ data, label }: { data: { district: string; value: number }[]; label: string }) {
  const values = Object.fromEntries(data.map((d) => [d.district, d.value]));
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = (v: number) => (v === 0 ? 0 : Math.min(4, 1 + Math.floor(((v - 0.001) / max) * 4)));
  const size = 52, gap = 4;
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${3 * (size + gap)} ${8 * (size + gap)}`} className="mx-auto h-auto w-full max-w-[220px]" role="img" aria-label={`${label} per district`}>
        {KERALA_DISTRICTS.map((d) => {
          const [cx, cy] = DISTRICT_TILES[d];
          const v = values[d] ?? 0;
          const s = step(v);
          return (
            <g key={d} transform={`translate(${cx * (size + gap)},${cy * (size + gap)})`}>
              <rect width={size} height={size} rx="8" fill={`var(--chart-seq-${s})`} stroke="var(--border)" />
              <text x={size / 2} y={21} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={`var(--chart-seq-ink-${s})`}>{d.slice(0, 5)}</text>
              <text x={size / 2} y={38} textAnchor="middle" fontSize="13" fontWeight="700" fill={`var(--chart-seq-ink-${s})`}>{v}</text>
              <title>{`${d}: ${v} ${label}`}</title>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex items-center justify-center gap-1 text-xs text-muted" aria-hidden="true">
        <span>Fewer</span>
        {[0, 1, 2, 3, 4].map((s) => <span key={s} className="h-3 w-6 rounded-sm" style={{ background: `var(--chart-seq-${s})` }} />)}
        <span>More</span>
      </div>
    </div>
  );
}
