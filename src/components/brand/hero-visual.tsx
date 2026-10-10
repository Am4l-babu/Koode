/**
 * Hero illustration: an open wreath of leaves around a gift — giving that
 * grows. Pure SVG with deterministic geometry so server and client agree;
 * gentle float animation is disabled under prefers-reduced-motion.
 */
const LEAF = "M0,-30 C16,-16 16,12 0,30 C-16,12 -16,-16 0,-30 Z";
const COLORS = ["#0f766e", "#22c55e", "#84cc16", "#f59e0b", "#14b8a6", "#fb923c", "#15803d", "#facc15"];

// Leaves along an open arc (a gap bottom-left, like a hand cupping the gift).
const leaves = Array.from({ length: 24 }, (_, i) => {
  const start = 150, sweep = 300;
  const deg = start + (sweep / 23) * i;
  const rad = (deg * Math.PI) / 180;
  const wobble = ((i * 37) % 11) - 5;
  const r = 168 + (i % 3) * 10 + wobble;
  const scale = 0.75 + ((i * 53) % 7) / 10;
  return {
    x: +(250 + r * Math.cos(rad)).toFixed(1),
    y: +(240 + r * Math.sin(rad)).toFixed(1),
    rot: +(deg + 90 + (i % 2 ? 28 : -22)).toFixed(1),
    scale: +scale.toFixed(2),
    color: COLORS[(i * 5) % COLORS.length]!,
  };
});

export function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[500px]" role="img" aria-label="Illustration: a gift held inside a wreath of leaves.">
      <svg viewBox="0 0 500 480" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id="hv-halo">
            <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hv-box" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="hv-side" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
          <linearGradient id="hv-hand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>

        <circle cx="250" cy="240" r="210" fill="url(#hv-halo)" />
        <circle cx="250" cy="240" r="128" fill="var(--surface)" opacity="0.9" />

        {/* Wreath */}
        {leaves.map((l, i) => (
          <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${l.scale})`}>
            <path d={LEAF} fill={l.color} opacity="0.92" />
            <path d="M0,-24 L0,24" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        ))}

        {/* Cupped hand sweeping under the gift */}
        <path d="M92 318 C120 392, 236 420, 330 372 C356 358, 372 340, 380 322 C350 342, 300 356, 250 354 C190 352, 140 340, 92 318 Z" fill="url(#hv-hand)" />
        <path d="M118 334 C170 360, 250 368, 330 346" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />

        {/* Gift */}
        <g className="float-slow">
          <ellipse cx="250" cy="338" rx="78" ry="10" fill="#000" opacity="0.08" />
          {/* body: front + side for a little depth */}
          <path d="M184 238 H300 V330 H184 Z" fill="url(#hv-box)" />
          <path d="M300 238 L326 224 V314 L300 330 Z" fill="url(#hv-side)" />
          {/* lid */}
          <path d="M176 214 H306 V242 H176 Z" fill="#fdba74" />
          <path d="M306 214 L334 199 V226 L306 242 Z" fill="#fb923c" />
          <path d="M176 214 L204 199 H334 L306 214 Z" fill="#fed7aa" />
          {/* ribbon */}
          <rect x="231" y="214" width="20" height="116" fill="#facc15" />
          <path d="M231 214 L259 199 H279 L251 214 Z" fill="#fde047" />
          <path d="M313 230 L313 320 L320 316 L320 226 Z" fill="#eab308" />
          {/* bow */}
          <path d="M241 204 C214 170, 182 186, 206 204 C220 213, 236 208, 241 204 Z" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
          <path d="M243 204 C262 166, 300 176, 280 200 C268 212, 250 208, 243 204 Z" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
          <circle cx="242" cy="204" r="8" fill="#eab308" />
        </g>

        {/* Sparkles */}
        <g fill="var(--accent)">
          <path d="M392 120 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" />
          <path d="M120 120 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" opacity="0.8" />
        </g>
        <circle cx="410" cy="300" r="5" fill="var(--secondary)" />
        <circle cx="96" cy="210" r="4" fill="var(--primary)" />
        <path d="M356 168 c0 -6 8 -8 10 -2 c2 -6 10 -4 10 2 c0 7 -10 12 -10 12 s-10 -5 -10 -12 Z" fill="#fb7185" />
      </svg>
    </div>
  );
}
