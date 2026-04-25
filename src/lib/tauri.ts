import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { LyricsPayload, PlaybackState, Playlist, Track } from "./types";

export const api = {
  // Library
  importTracks: (paths: string[]) => invoke<Track[]>("import_tracks", { paths }),
  listTracks:   () => invoke<Track[]>("list_tracks"),
  deleteTrack:  (id: string) => invoke<void>("delete_track", { id }),
  recordPlay:   (trackId: string) => invoke<void>("record_play", { trackId }),

  // Playlists
  createPlaylist: (name: string) => invoke<Playlist>("create_playlist", { name }),
  listPlaylists:  () => invoke<Playlist[]>("list_playlists"),
  addToPlaylist:  (playlistId: string, trackId: string) =>
    invoke<void>("add_to_playlist", { playlistId, trackId }),
  monthlyRecap:   (yearMonth: string) =>
    invoke<{ track_id: string; title: string; artist: string; plays: number }[]>(
      "monthly_recap", { yearMonth },
    ),

  // Tags
  readTags: (trackId: string) =>
    invoke<{ title: string; artist: string; album: string; has_cover: boolean }>(
      "read_tags", { trackId },
    ),
  writeTags: (trackId: string, payload: { title?: string; artist?: string; album?: string }) =>
    invoke<void>("write_tags", { trackId, payload }),
  setCover: (trackId: string, imageBytes: Uint8Array, mime?: string) =>
    invoke<string>("set_cover", { trackId, imageBytes: Array.from(imageBytes), mime }),

  // Lyrics
  fetchLyrics: (trackId: string) => invoke<LyricsPayload>("fetch_lyrics", { trackId }),
  loadLrc:     (trackId: string) => invoke<LyricsPayload | null>("load_lrc", { trackId }),
  saveLrc:     (trackId: string, body: string, synced: boolean, source?: string) =>
    invoke<void>("save_lrc", { trackId, body, synced, source }),

  // Playback
  play:    (trackId: string) => invoke<void>("play", { trackId }),
  pause:   () => invoke<void>("pause"),
  resume:  () => invoke<void>("resume"),
  stop:    () => invoke<void>("stop"),
  seek:    (positionMs: number) => invoke<void>("seek", { positionMs }),
  setVol:  (volume: number) => invoke<void>("set_volume", { volume }),
  setEq:   (gainsDb: number[]) => invoke<void>("set_eq", { bands: { gains_db: gainsDb } }),
  setCrossfade:     (ms: number) => invoke<void>("set_crossfade", { ms }),
  setNormalization: (enabled: boolean) => invoke<void>("set_normalization", { enabled }),
};

export function onPosition(cb: (s: PlaybackState) => void): Promise<UnlistenFn> {
  return listen<PlaybackState>("liplay://position", (e) => cb(e.payload));
}

/** Convert an absolute path inside the app's data dir into a `tauri://` URL
 *  the WebView can render directly (used for covers and karaoke art). */
export function toAssetUrl(absPath: string): string {
  return convertFileSrc(absPath);
}
