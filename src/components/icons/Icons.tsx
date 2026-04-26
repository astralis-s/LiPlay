// Custom SVG icon set. No emojis, no icon fonts. Strokes inherit currentColor.

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
  <svg {...base} {...p}>
    <path d="M6 5l10 7-10 7V5z" fill="currentColor" stroke="none" />
    <path d="M18 5v14" />
  </svg>
);
export const IconSkipPrev = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M18 5L8 12l10 7V5z" fill="currentColor" stroke="none" />
    <path d="M6 5v14" />
  </svg>
);
export const IconKaraoke = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>
);
export const IconLibrary = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="4" y="5" width="16" height="3" rx="1" />
    <rect x="4" y="10.5" width="16" height="3" rx="1" />
    <rect x="4" y="16" width="16" height="3" rx="1" />
  </svg>
);
export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>
);
export const IconRepeat = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 9V7a2 2 0 0 1 2-2h12l-3-3M20 15v2a2 2 0 0 1-2 2H6l3 3" />
  </svg>
);
export const IconRepeatOne = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 9V7a2 2 0 0 1 2-2h12l-3-3M20 15v2a2 2 0 0 1-2 2H6l3 3" />
    <text x="12" y="14" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">1</text>
  </svg>
);
export const IconShuffle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M16 4h4v4M20 4l-7 7M4 4l7 7M16 20h4v-4M20 20l-5-5M4 20l5-5" />
  </svg>
);
export const IconDots = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="5"  cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
  </svg>
);
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
  </svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconEdit = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M14 4l6 6M4 20v-4l12-12 4 4-12 12H4z" />
  </svg>
);
export const IconLyrics = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 6h12M4 11h16M4 16h10" />
  </svg>
);

/**
 * App logo — minimalist black square with rounded corners, white play
 * triangle and the accent dot. Matches the AppImage icon SVG.
 */
export const IconLogo = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 64 64" width="64" height="64" {...p}>
    <rect width="64" height="64" rx="14" fill="currentColor" />
    <path
      d="M24 19l18 13-18 13z"
      fill="rgb(var(--bg))"
      stroke="none"
    />
    <circle cx="46" cy="32" r="3" fill="rgb(var(--bg))" />
  </svg>
);
