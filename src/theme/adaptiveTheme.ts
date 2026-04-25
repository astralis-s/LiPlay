/**
 * Adaptive Monet-Style theme generator.
 *
 *   1. Sample the album cover into ~4096 pixels (downscale via canvas).
 *   2. Convert each sample sRGB -> OKLab -> OKLCH (perceptually uniform).
 *   3. Run weighted k-means in OKLab (k = 5).
 *   4. Pick the most "perceptually weighty" cluster as the seed hue.
 *   5. Build a balanced pastel palette around that hue:
 *        bg       L = 0.96  C = 0.04  (light) / 0.18  0.05 (dark)
 *        surface  L = 0.99 / 0.22
 *        elevated L = 0.93 / 0.28
 *        accent   L = 0.55  C = 0.16
 *        text     contrast-clamped to AA against bg
 *   6. Snap each token to WCAG AA via ensureContrast() so Inter is always readable.
 *   7. Return tokens for the theme engine to crossfade into CSS vars.
 */

import { ensureContrast, type RGB } from "./contrast";
import type { ThemeTokens } from "./themes";

// ---------- color space conversions ----------

const srgb2lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const lin2srgb = (c: number) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};

interface Lab { L: number; a: number; b: number; }
interface LCh { L: number; C: number; h: number; }

function srgbToOklab([r, g, b]: RGB): Lab {
  const lr = srgb2lin(r), lg = srgb2lin(g), lb = srgb2lin(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}
function oklabToSrgb({ L, a, b }: Lab): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lr =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [lin2srgb(lr), lin2srgb(lg), lin2srgb(lb)];
}
function labToLCh({ L, a, b }: Lab): LCh {
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
}
function lchToLab({ L, C, h }: LCh): Lab {
  return { L, a: Math.cos(h) * C, b: Math.sin(h) * C };
}

// ---------- sampling ----------

async function samplePixels(imgUrl: string, target = 64): Promise<RGB[]> {
  const img = await loadImage(imgUrl);
  const cv = document.createElement("canvas");
  cv.width = target; cv.height = target;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, target, target);
  const { data } = ctx.getImageData(0, 0, target, target);
  const out: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 200) continue;
    out.push([data[i], data[i + 1], data[i + 2]]);
  }
  return out;
}
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

// ---------- weighted k-means in OKLab ----------

function kmeans(pixels: Lab[], k: number, iters = 12): { center: Lab; weight: number }[] {
  if (pixels.length === 0) return [];
  // Seed with a stride-pick to avoid pathological blank covers.
  const stride = Math.max(1, Math.floor(pixels.length / k));
  let centers: Lab[] = Array.from({ length: k }, (_, i) => pixels[(i * stride) % pixels.length]);

  for (let it = 0; it < iters; it++) {
    const sums = centers.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (const p of pixels) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < centers.length; i++) {
        const c = centers[i];
        const d = (p.L - c.L) ** 2 + (p.a - c.a) ** 2 + (p.b - c.b) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      const s = sums[best];
      s.L += p.L; s.a += p.a; s.b += p.b; s.n += 1;
    }
    centers = sums.map((s, i) =>
      s.n === 0 ? centers[i] : { L: s.L / s.n, a: s.a / s.n, b: s.b / s.n },
    );
  }

  const counts = centers.map(() => 0);
  for (const p of pixels) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < centers.length; i++) {
      const c = centers[i];
      const d = (p.L - c.L) ** 2 + (p.a - c.a) ** 2 + (p.b - c.b) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    counts[best]++;
  }
  return centers.map((c, i) => ({ center: c, weight: counts[i] }));
}

// ---------- palette assembly ----------

export interface AdaptiveOptions {
  mode: "light" | "dark";
  /** Minimum WCAG ratio for body text vs background. */
  minTextContrast?: number;
}

export async function generateAdaptiveTheme(
  coverUrl: string,
  opts: AdaptiveOptions,
): Promise<ThemeTokens> {
  const samples = await samplePixels(coverUrl);
  const labs = samples.map(srgbToOklab);
  const clusters = kmeans(labs, 5);

  // Score: weight * chroma (favor saturated, prominent regions).
  const scored = clusters
    .map((c) => {
      const lch = labToLCh(c.center);
      return { ...c, lch, score: c.weight * (0.15 + lch.C) };
    })
    .sort((a, b) => b.score - a.score);

  const seed = scored[0]?.lch ?? { L: 0.6, C: 0.1, h: 0 };

  // Build palette around the seed hue.
  const isLight = opts.mode === "light";
  const tokens = isLight
    ? {
        bg:       { L: 0.965, C: 0.035 },
        surface:  { L: 0.99,  C: 0.020 },
        elevated: { L: 0.93,  C: 0.045 },
        text:     { L: 0.20,  C: 0.060 },
        muted:    { L: 0.55,  C: 0.040 },
        accent:   { L: 0.55,  C: 0.165 },
        outline:  { L: 0.88,  C: 0.030 },
      }
    : {
        bg:       { L: 0.16,  C: 0.040 },
        surface:  { L: 0.21,  C: 0.045 },
        elevated: { L: 0.27,  C: 0.050 },
        text:     { L: 0.96,  C: 0.020 },
        muted:    { L: 0.70,  C: 0.030 },
        accent:   { L: 0.78,  C: 0.150 },
        outline:  { L: 0.32,  C: 0.040 },
      };

  const bake = (t: { L: number; C: number }): RGB =>
    oklabToSrgb(lchToLab({ L: t.L, C: t.C, h: seed.h }));

  const bg = bake(tokens.bg);
  let text = bake(tokens.text);
  let muted = bake(tokens.muted);
  let accent = bake(tokens.accent);

  const target = opts.minTextContrast ?? 4.5;
  text   = ensureContrast(text, bg, target);
  muted  = ensureContrast(muted, bg, 3.0);   // muted text held to AA-large
  accent = ensureContrast(accent, bg, 3.0);

  return {
    bg,
    surface:  bake(tokens.surface),
    elevated: bake(tokens.elevated),
    text,
    muted,
    accent,
    outline:  bake(tokens.outline),
  };
}
