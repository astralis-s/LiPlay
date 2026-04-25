import type { ParsedLrcLine } from "./types";

const TIMESTAMP = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

/** Parse a .lrc body into time-sorted lines.
 *  Falls back to one untimed line per source line if no timestamps exist. */
export function parseLrc(body: string): ParsedLrcLine[] {
  const lines: ParsedLrcLine[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const text = raw.replace(TIMESTAMP, "").trim();
    const matches = [...raw.matchAll(TIMESTAMP)];
    if (matches.length === 0) {
      if (text) lines.push({ time: -1, text });
      continue;
    }
    for (const m of matches) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) : 0;
      lines.push({ time: min * 60_000 + sec * 1_000 + frac, text });
    }
  }
  // Sort timed lines first; unsynced lines bubble to the end in source order.
  return lines
    .map((l, i) => ({ l, i }))
    .sort((a, b) => {
      if (a.l.time === -1 && b.l.time === -1) return a.i - b.i;
      if (a.l.time === -1) return 1;
      if (b.l.time === -1) return -1;
      return a.l.time - b.l.time;
    })
    .map(({ l }) => l);
}

/** Inverse of parseLrc for the manual-sync flow. */
export function serializeLrc(lines: ParsedLrcLine[]): string {
  return lines
    .map((l) => {
      if (l.time < 0) return l.text;
      const totalSec = l.time / 1000;
      const min = Math.floor(totalSec / 60).toString().padStart(2, "0");
      const sec = Math.floor(totalSec % 60).toString().padStart(2, "0");
      const cs = Math.floor((l.time % 1000) / 10).toString().padStart(2, "0");
      return `[${min}:${sec}.${cs}]${l.text}`;
    })
    .join("\n");
}

/** Index of the line that should be highlighted at `positionMs`. */
export function activeLineIndex(lines: ParsedLrcLine[], positionMs: number): number {
  if (lines.length === 0) return -1;
  // Binary search across timed lines.
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = lines[mid].time;
    if (t < 0) { hi = mid - 1; continue; }
    if (t <= positionMs) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}
