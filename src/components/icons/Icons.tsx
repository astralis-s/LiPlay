// Custom SVG icon set. No emojis, no icon fonts. Strokes inherit currentColor
// so themed text/accent vars apply automatically.

import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M7 5l12 7-12 7V5z" fill="currentColor" stroke="none" /></svg>
);
export const IconPause = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" stroke="none" /></svg>
);
export const IconSkipNext = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M6 5l10 7-10 7zM18 5v14" /></svg>
);
export const IconSkipPrev = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M18 5L8 12l10 7zM6 5v14" /></svg>
);
export const IconKaraoke = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /></svg>
);
export const IconLibrary = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M4 4v16M9 4v16M14 6l6 14M20 4l-6 16" /></svg>
);
export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>
);
export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>
);
export const IconLogo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} viewBox="0 0 64 64" width="64" height="64" {...p}>
    <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.08" />
    <path d="M22 18v22a6 6 0 1 1-4-5.7V18z" fill="currentColor" stroke="none" />
    <circle cx="44" cy="32" r="3" fill="currentColor" stroke="none" />
  </svg>
);
