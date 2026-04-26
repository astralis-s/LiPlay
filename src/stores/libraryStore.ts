import { create } from "zustand";
import { api } from "@/lib/tauri";
import type { Playlist, Track } from "@/lib/types";

interface LibraryStore {
  tracks: Track[];
  playlists: Playlist[];
  loading: boolean;
  refreshTracks: () => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  importFromPaths: (paths: string[]) => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
}

export const useLibrary = create<LibraryStore>((set, get) => ({
  tracks: [],
  playlists: [],
  loading: false,

  async refreshTracks() {
    set({ loading: true });
    try { set({ tracks: await api.listTracks() }); }
    finally { set({ loading: false }); }
  },

  async refreshPlaylists() {
    set({ playlists: await api.listPlaylists() });
  },

  async importFromPaths(paths) {
    if (paths.length === 0) return;
    await api.importTracks(paths);
    await get().refreshTracks();
  },

  async removeTrack(id) {
    await api.deleteTrack(id);
    set({ tracks: get().tracks.filter((t) => t.id !== id) });
  },

  async createPlaylist(name) {
    await api.createPlaylist(name);
    await get().refreshPlaylists();
  },

  async deletePlaylist(id) {
    await api.deletePlaylist(id);
    set({ playlists: get().playlists.filter((p) => p.id !== id) });
  },

  async addToPlaylist(playlistId, trackId) {
    await api.addToPlaylist(playlistId, trackId);
  },

  async removeFromPlaylist(playlistId, trackId) {
    await api.removeFromPlaylist(playlistId, trackId);
  },
}));
