import { create } from "zustand";
import { applyTokens, baseThemes, type ThemeId, type ThemeTokens } from "@/theme/themes";
import { generateAdaptiveTheme } from "@/theme/adaptiveTheme";

interface ThemeStore {
  id: ThemeId;
  tokens: ThemeTokens;
  customAccent?: [number, number, number];
  setTheme: (id: ThemeId) => void;
  setCustomAccent: (rgb: [number, number, number]) => void;
  /** Recompute adaptive palette from a cover image URL.
   *  No-op if the active theme is not an adaptive variant. */
  refreshAdaptive: (coverUrl: string | null) => Promise<void>;
}

function isAdaptive(id: ThemeId): id is "adaptive-light" | "adaptive-dark" {
  return id === "adaptive-light" || id === "adaptive-dark";
}

export const useTheme = create<ThemeStore>((set, get) => ({
  id: "clean-light",
  tokens: baseThemes["clean-light"],

  setTheme(id) {
    if (isAdaptive(id)) { set({ id }); return; }
    const tokens = { ...baseThemes[id] };
    if (id.endsWith("-accent") && get().customAccent) tokens.accent = get().customAccent!;
    applyTokens(tokens);
    set({ id, tokens });
  },

  setCustomAccent(rgb) {
    set({ customAccent: rgb });
    const { id, tokens } = get();
    if (id === "light-accent" || id === "dark-accent") {
      const next = { ...tokens, accent: rgb };
      applyTokens(next);
      set({ tokens: next });
    }
  },

  async refreshAdaptive(coverUrl) {
    const { id } = get();
    if (!isAdaptive(id) || !coverUrl) return;
    const tokens = await generateAdaptiveTheme(coverUrl, {
      mode: id === "adaptive-dark" ? "dark" : "light",
    });
    applyTokens(tokens);
    set({ tokens });
  },
}));
