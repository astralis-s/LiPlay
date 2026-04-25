// WCAG contrast utilities. Inputs are sRGB 0-255 triplets.

export type RGB = [number, number, number];

const srgbToLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export function relativeLuminance([r, g, b]: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Adjust `fg` toward black or white until contrast against `bg` >= target.
 *  Preserves hue by stepping in linear space toward whichever endpoint is
 *  further from `bg` (so light backgrounds darken text and vice versa). */
export function ensureContrast(fg: RGB, bg: RGB, target = 4.5): RGB {
  if (contrastRatio(fg, bg) >= target) return fg;
  const bgL = relativeLuminance(bg);
  const goDark = bgL > 0.5;
  const endpoint: RGB = goDark ? [0, 0, 0] : [255, 255, 255];

  // Binary search the mix factor (0 = original fg, 1 = endpoint).
  let lo = 0, hi = 1, best = endpoint;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    const mix: RGB = [
      Math.round(fg[0] + (endpoint[0] - fg[0]) * t),
      Math.round(fg[1] + (endpoint[1] - fg[1]) * t),
      Math.round(fg[2] + (endpoint[2] - fg[2]) * t),
    ];
    if (contrastRatio(mix, bg) >= target) { best = mix; hi = t; }
    else lo = t;
  }
  return best;
}
