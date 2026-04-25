import { create } from "zustand";

interface UiStore {
  leftOpen: boolean;
  rightOpen: boolean;
  karaoke: boolean;
  toggleLeft: () => void;
  toggleRight: () => void;
  setKaraoke: (v: boolean) => void;
}

export const useUi = create<UiStore>((set) => ({
  leftOpen: true,
  rightOpen: false,
  karaoke: false,
  toggleLeft:  () => set((s) => ({ leftOpen:  !s.leftOpen  })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  setKaraoke: (karaoke) => set({ karaoke }),
}));
