import { create } from "zustand";
import type { PlaybackState, Track } from "@/lib/types";
import { api, onPosition } from "@/lib/tauri";

export type RepeatMode = "off" | "all" | "one";

interface PlayerStore extends PlaybackState {
  current: Track | null;
  queue: Track[];
  shuffle: boolean;
  repeat: RepeatMode;

  setCurrent: (t: Track | null) => void;
  setQueue: (q: Track[]) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  bind: () => Promise<() => void>;
  playTrack: (t: Track) => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
}

function shuffledNext(queue: Track[], current: Track): Track | undefined {
  if (queue.length <= 1) return undefined;
  const remaining = queue.filter((q) => q.id !== current.id);
  return remaining[Math.floor(Math.random() * remaining.length)];
}

export const usePlayer = create<PlayerStore>((set, get) => ({
  track_id: null,
  position_ms: 0,
  duration_ms: 0,
  playing: false,
  volume: 1,
  current: null,
  queue: [],
  shuffle: false,
  repeat: "off",

  setCurrent: (current) => set({ current }),
  setQueue: (queue) => set({ queue }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" })),

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
    const { queue, current, shuffle, repeat } = get();
    if (!current) return;
    if (repeat === "one") { await get().playTrack(current); return; }

    const i = queue.findIndex((q) => q.id === current.id);
    let nxt: Track | undefined;
    if (shuffle) {
      nxt = shuffledNext(queue, current);
    } else {
      nxt = queue[i + 1];
      if (!nxt && repeat === "all") nxt = queue[0];
    }
    if (nxt) await get().playTrack(nxt);
  },
  async prev() {
    const { queue, current, position_ms } = get();
    if (!current) return;
    // Apple-style: > 3s into the song just rewinds, otherwise jumps to prev.
    if (position_ms > 3000) { await api.seek(0); return; }
    const i = queue.findIndex((q) => q.id === current.id);
    const prv = queue[i - 1];
    if (prv) await get().playTrack(prv);
    else await api.seek(0);
  },
}));
