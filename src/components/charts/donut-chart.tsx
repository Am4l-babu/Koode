"use client";

import { useState } from "react";

const SLOTS = 6;

/**
 * Donut with ≤6 categorical slots in fixed order (by entity, never by rank);
 * anything beyond folds into "Other". Legend always shows label + value.
 */
export function DonutChart({ data, centerLabel }: { data: { key: string; label: string; value: number }[]; centerLabel: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const main = data.slice(0, SLOTS);
  const rest = data.slice(SLOTS).reduce((s, d) => s + d.value, 0);
  const slices = [...main.map((d, i) => ({ ...d, color: `var(--chart-${i + 1})` })), ...(rest ? [{ key: "other", label: "Other", value: rest, color: "var(--chart-other)" }] : [])];
  const total = slices.reduce((s, d) => s + d.value, 0);
  const R = 70, r = 46, C = 90;
  let angle = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const sweep = total ? (s.value / total) * Math.PI * 2 : 0;
    const a0 = angle, a1 = angle + sweep;
    angle = a1;
    const large = sweep > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${C + rad * Math.cos(a)},${C + rad * Math.sin(a)}`;
    const d = sweep >= Math.PI * 2 - 1e-6
      ? `M${C - R},${C} a${R},${R} 0 1,0 ${2 * R},0 a${R},${R} 0 1,0 ${-2 * R},0 M${C - r},${C} a${r},${r} 0 1,1 ${2 * r},0 a${r},${r} 0 1,1 ${-2 * r},0`
      : `M${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${large} 0 ${p(r, a0)} Z`;
    return { ...s, d };
  });
  const active = slices.find((s) => s.key === hover);

  if (!total) return <p className="py-10 text-center text-sm text-muted">No donations in this period yet.</p>;
  return (
    <div className="flex flex-col items-center gap-5">
      <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0" role="img" aria-label={`${centerLabel} by category`}>
        {arcs.map((a) => (
          <path
            key={a.key}
            d={a.d}
            fill={a.color}
            fillRule="evenodd"
            stroke="var(--surface)"
            strokeWidth="2"
            opacity={hover && hover !== a.key ? 0.35 : 1}
            onMouseEnter={() => setHover(a.key)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${a.label}: ${a.value}`}</title>
          </path>
        ))}
        <text x={C} y={C - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--fg)">{active ? active.value : total}</text>
        <text x={C} y={C + 16} textAnchor="middle" fontSize="10" fill="var(--fg-muted)">{active ? active.label : centerLabel}</text>
      </svg>
      <ul className="grid w-full gap-1 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 hover:bg-surface-2" onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
            <span className="flex items-center gap-2 text-fg">
              <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </span>
            <span className="tabular-nums text-muted">{s.value} <span className="text-subtle">({Math.round((s.value / total) * 100)}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
