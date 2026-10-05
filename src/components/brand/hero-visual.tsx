/**
 * Hero illustration: an anonymous donor → secure glowing pathway → trusted
 * platform → verified recipient. A gift card travels along the path.
 * Pure SVG + CSS (offset-path); disabled under prefers-reduced-motion.
 */
export function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[520px]" role="img" aria-label="Illustration: a donation travels from an anonymous donor, through Koode, to a verified organisation.">
      <svg viewBox="0 0 500 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="hv-path" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--secondary)" />
          </linearGradient>
          <filter id="hv-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <radialGradient id="hv-halo">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="250" cy="190" r="150" fill="url(#hv-halo)" />
        {/* Glow + path */}
        <path d="M 70 70 C 160 70, 160 190, 250 190 S 340 310, 430 310" fill="none" stroke="url(#hv-path)" strokeWidth="14" opacity="0.25" filter="url(#hv-glow)" />
        <path d="M 70 70 C 160 70, 160 190, 250 190 S 340 310, 430 310" fill="none" stroke="url(#hv-path)" strokeWidth="3" strokeLinecap="round" className="path-dash" />

        {/* Donor (anonymous) */}
        <g>
          <circle cx="70" cy="70" r="40" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
          <circle cx="70" cy="60" r="12" fill="var(--surface-3)" />
          <path d="M48 92 C 52 76, 88 76, 92 92" fill="var(--surface-3)" />
          <rect x="54" y="54" width="32" height="10" rx="5" fill="var(--fg)" opacity="0.75" />
          <text x="70" y="132" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--fg-muted)">Donor #D••••</text>
        </g>

        {/* Platform shield */}
        <g className="float-slow">
          <circle cx="250" cy="190" r="50" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2" />
          <path d="M250 158 L276 168 V188 C276 206 264 218 250 223 C236 218 224 206 224 188 V168 Z" fill="var(--primary)" />
          <path d="M240 190 l7 7 l14 -15" fill="none" stroke="var(--primary-fg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <text x="250" y="262" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--primary-ink)">Koode coordinates</text>
        </g>

        {/* Recipient */}
        <g>
          <circle cx="430" cy="310" r="40" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
          <path d="M408 322 L430 300 L452 322 V334 H408 Z" fill="var(--secondary-soft)" stroke="var(--secondary)" strokeWidth="2" strokeLinejoin="round" />
          <rect x="424" y="318" width="12" height="16" rx="2" fill="var(--secondary)" />
          <circle cx="452" cy="286" r="10" fill="var(--secondary)" />
          <path d="M447 286 l3.5 3.5 l6 -7" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="430" y="372" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--fg-muted)">Verified organisation</text>
        </g>

        {/* Travelling gift — SMIL motion scales with the SVG; hidden for reduced motion */}
        <g className="travel">
          <g transform="translate(-20,-16)">
            <rect width="40" height="32" rx="8" fill="var(--accent)" />
            <path d="M20 6v22M6 14h28" stroke="#3b2300" strokeWidth="2.5" />
            <path d="M20 12c-2-4-7-4-7-1.5S17 12 20 12c3 0 7 1 7-1.5S22 8 20 12" fill="none" stroke="#3b2300" strokeWidth="2" />
          </g>
          <animateMotion dur="5.5s" repeatCount="indefinite" path="M 70 70 C 160 70, 160 190, 250 190 S 340 310, 430 310" />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.92;1" dur="5.5s" repeatCount="indefinite" />
        </g>
      </svg>

      <div className="absolute left-1/2 top-[6%] -translate-x-1/2 rounded-full border border-line bg-surface/90 px-3 py-1.5 text-xs font-semibold text-primary-ink shadow-soft backdrop-blur">
        Anonymous donation
      </div>
    </div>
  );
}
