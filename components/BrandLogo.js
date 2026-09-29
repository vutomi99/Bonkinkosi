"use client";

// Radar-sweep logo: static grid rings + crosshair, with a rotating sweep
// wedge and leading edge line. Pure SVG + CSS (see .brand-radar* in
// app/globals.css), so it animates without any library.
export default function BrandLogo() {
  return (
    <svg className="brand-radar" viewBox="0 0 100 100" width="40" height="40" aria-hidden="true">
      <defs>
        <linearGradient id="radar-sweep" x1="78" y1="22" x2="50" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#EAFBF3" stopOpacity="0" />
          <stop offset="1" stopColor="#EAFBF3" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <g stroke="#EAFBF3" strokeOpacity="0.45" fill="none" strokeWidth="2">
        <circle cx="50" cy="50" r="40" />
        <circle cx="50" cy="50" r="26" />
        <circle cx="50" cy="50" r="12" />
        <line x1="10" y1="50" x2="90" y2="50" />
        <line x1="50" y1="10" x2="50" y2="90" />
      </g>
      <g className="brand-radar-sweep">
        <path d="M50 50 L50 10 A40 40 0 0 1 78.3 21.7 Z" fill="url(#radar-sweep)" />
        <line x1="50" y1="50" x2="50" y2="10" stroke="#EAFBF3" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="4" fill="#EAFBF3" />
    </svg>
  );
}
