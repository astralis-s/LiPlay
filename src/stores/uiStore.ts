import { create } from "zustand";

export type View =
  | { kind: "home" }
  | { kind: "library" }
  | { kind: "playlist"; id: string };

interface UiStore {
  leftOpen: boolean;
  rightOpen: boolean;
  karaoke: boolean;
  eqOpen: boolean;
  themeOpen: boolean;
  listenOpen: boolean;
  view: View;

  toggleLeft: () => void;
  toggleRight: () => void;
  setKaraoke: (v: boolean) => void;
  openEq: () => void;
  closeEq: () => void;
  openTheme: () => void;
  closeTheme: () => void;
  openListen: () => void;
  closeListen: () => void;
  setView: (v: View) => void;
}

export const useUi = create<UiStore>((set) => ({
  leftOpen: true,
  rightOpen: false,
  karaoke: false,
  eqOpen: false,
  themeOpen: false,
  listenOpen: false,
  view: { kind: "home" },

  toggleLeft:  () => set((s) => ({ leftOpen:  !s.leftOpen  })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  setKaraoke:  (karaoke) => set({ karaoke }),
  openEq:      () => set({ eqOpen: true }),
  closeEq:     () => set({ eqOpen: false }),
  openTheme:   () => set({ themeOpen: true }),
  closeTheme:  () => set({ themeOpen: false }),
  openListen:  () => set({ listenOpen: true }),
  closeListen: () => set({ listenOpen: false }),
  setView:     (view) => set({ view }),
}));
