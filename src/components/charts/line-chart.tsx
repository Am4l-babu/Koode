"use client";

import { useState } from "react";

/** Single-series line/area chart with crosshair + tooltip. One y-axis only. */
export function LineChart({ data, valueLabel }: { data: { label: string; value: number; detail?: string }[]; valueLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 220, P = { l: 36, r: 12, t: 12, b: 28 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = Math.ceil(max / 4) * 4 || 4;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - P.b - (v / nice) * (H - P.t - P.b);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`;
  const ticks = [0, nice / 4, nice / 2, (3 * nice) / 4, nice];
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${valueLabel} by month`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--fg-subtle)">{t}</text>
          </g>
        ))}
        <path d={area} fill="var(--chart-1)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={d.label}>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--fg-subtle)">{d.label}</text>
            <circle cx={x(i)} cy={y(d.value)} r={hover === i ? 5 : 4} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth="2" />
            <rect
              x={x(i) - (W - P.l - P.r) / Math.max(1, data.length - 1) / 2}
              y={P.t}
              width={(W - P.l - P.r) / Math.max(1, data.length - 1)}
              height={H - P.t - P.b}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              aria-label={`${d.label}: ${d.value} ${valueLabel}`}
            />
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--fg-subtle)" strokeDasharray="3 3" />}
        {data.length > 0 && hover === null && (
          <text x={x(data.length - 1) - 10} y={y(data[data.length - 1]!.value) - 10} textAnchor="end" fontSize="12" fontWeight="600" fill="var(--fg)">
            {data[data.length - 1]!.value}
          </text>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > data.length / 2 ? "translateX(-105%)" : "translateX(8px)" }}
        >
          <p className="font-semibold text-fg">{h.label}</p>
          <p className="text-muted"><span className="font-semibold text-fg">{h.value}</span> {valueLabel}</p>
          {h.detail && <p className="text-muted">{h.detail}</p>}
        </div>
      )}
    </div>
  );
}
