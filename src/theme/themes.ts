export type ThemeId =
  | "clean-light"
  | "deep-dark"
  | "light-accent"
  | "dark-accent"
  | "adaptive-light"
  | "adaptive-dark";

export interface ThemeTokens {
  bg: [number, number, number];
  surface: [number, number, number];
  elevated: [number, number, number];
  text: [number, number, number];
  muted: [number, number, number];
  accent: [number, number, number];
  outline: [number, number, number];
}

export const baseThemes: Record<Exclude<ThemeId, "adaptive-light" | "adaptive-dark">, ThemeTokens> = {
  "clean-light": {
    bg: [250, 250, 252],
    surface: [255, 255, 255],
    elevated: [244, 244, 248],
    text: [17, 17, 19],
    muted: [110, 110, 120],
    accent: [20, 20, 22],
    outline: [235, 235, 240],
  },
  "deep-dark": {
    bg: [10, 10, 12],
    surface: [18, 18, 22],
    elevated: [26, 26, 30],
    text: [240, 240, 244],
    muted: [150, 150, 160],
    accent: [240, 240, 244],
    outline: [38, 38, 44],
  },
  "light-accent": {
    bg: [250, 250, 252],
    surface: [255, 255, 255],
    elevated: [244, 244, 248],
    text: [17, 17, 19],
    muted: [110, 110, 120],
    accent: [88, 86, 214], // user-overridable
    outline: [235, 235, 240],
  },
  "dark-accent": {
    bg: [10, 10, 12],
    surface: [18, 18, 22],
    elevated: [26, 26, 30],
    text: [240, 240, 244],
    muted: [150, 150, 160],
    accent: [120, 119, 230],
    outline: [38, 38, 44],
  },
};

/** Apply tokens by writing CSS custom properties on <html>. */
export function applyTokens(t: ThemeTokens) {
  const root = document.documentElement;
  const set = (k: string, v: [number, number, number]) =>
    root.style.setProperty(k, `${v[0]} ${v[1]} ${v[2]}`);
  set("--bg", t.bg);
  set("--surface", t.surface);
  set("--elevated", t.elevated);
  set("--text", t.text);
  set("--muted", t.muted);
  set("--accent", t.accent);
  set("--outline", t.outline);
}
