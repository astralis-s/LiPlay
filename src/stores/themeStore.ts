import { create } from "zustand";
import { applyTokens, baseThemes, type ThemeId, type ThemeTokens } from "@/theme/themes";
import { generateAdaptiveTheme } from "@/theme/adaptiveTheme";

interface ThemeStore {
  id: ThemeId;
  tokens: ThemeTokens;
  customAccent?: [number, number, number];
  setTheme: (id: ThemeId) => void;
  setCustomAccent: (rgb: [number, number, number]) => void;
  /** Recompute adaptive palette from a cover image URL. No-op if id != adaptive. */
  refreshAdaptive: (coverUrl: string | null, prefersDark: boolean) => Promise<void>;
}

export const useTheme = create<ThemeStore>((set, get) => ({
  id: "clean-light",
  tokens: baseThemes["clean-light"],

  setTheme(id) {
    if (id === "adaptive") { set({ id }); return; }
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

  async refreshAdaptive(coverUrl, prefersDark) {
    if (get().id !== "adaptive" || !coverUrl) return;
    const tokens = await generateAdaptiveTheme(coverUrl, {
      mode: prefersDark ? "dark" : "light",
    });
    applyTokens(tokens);
    set({ tokens });
  },
}));
