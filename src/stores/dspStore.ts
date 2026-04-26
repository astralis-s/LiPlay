import { create } from "zustand";
import { api } from "@/lib/tauri";
import type { DspMode } from "@/lib/types";

interface DspStore {
  gainsDb: number[];           // 10 bands
  crossfadeMs: number;
  normalize: boolean;
  mode: DspMode;
  setBand: (i: number, db: number) => void;
  resetEq: () => void;
  setCrossfade: (ms: number) => void;
  setNormalize: (on: boolean) => void;
  setMode: (m: DspMode) => void;
}

export const EQ_LABELS = ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];

export const useDsp = create<DspStore>((set, get) => ({
  gainsDb: Array(10).fill(0),
  crossfadeMs: 0,
  normalize: false,
  mode: "off",

  setBand(i, db) {
    const next = [...get().gainsDb];
    next[i] = db;
    set({ gainsDb: next });
    api.setEq(next).catch(() => {});
  },
  resetEq() {
    const next = Array(10).fill(0);
    set({ gainsDb: next });
    api.setEq(next).catch(() => {});
  },
  setCrossfade(ms) {
    set({ crossfadeMs: ms });
    api.setCrossfade(ms).catch(() => {});
  },
  setNormalize(on) {
    set({ normalize: on });
    api.setNormalization(on).catch(() => {});
  },
  setMode(mode) {
    set({ mode });
    api.setDspMode(mode).catch(() => {});
  },
}));
