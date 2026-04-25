import { create } from "zustand";
import type { PlaybackState, Track } from "@/lib/types";
import { api, onPosition } from "@/lib/tauri";

interface PlayerStore extends PlaybackState {
  current: Track | null;
  queue: Track[];
  setCurrent: (t: Track | null) => void;
  setQueue: (q: Track[]) => void;
  bind: () => Promise<() => void>;
  playTrack: (t: Track) => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
}

export const usePlayer = create<PlayerStore>((set, get) => ({
  track_id: null,
  position_ms: 0,
  duration_ms: 0,
  playing: false,
  volume: 1,
  current: null,
  queue: [],

  setCurrent: (current) => set({ current }),
  setQueue: (queue) => set({ queue }),

  async bind() {
    return await onPosition((s) => set(s));
  },

  async playTrack(t) {
    set({ current: t });
    await api.play(t.id);
    api.recordPlay(t.id).catch(() => {});
  },

  async toggle() {
    const { playing } = get();
    if (playing) await api.pause(); else await api.resume();
  },

  async next() {
    const { queue, current } = get();
    if (!current) return;
    const i = queue.findIndex((q) => q.id === current.id);
    const nxt = queue[i + 1];
    if (nxt) await get().playTrack(nxt);
  },
  async prev() {
    const { queue, current } = get();
    if (!current) return;
    const i = queue.findIndex((q) => q.id === current.id);
    const prv = queue[i - 1];
    if (prv) await get().playTrack(prv);
  },
}));
