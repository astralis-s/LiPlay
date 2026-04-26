import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { DspMode, LyricsPayload, PlaybackState, Playlist, Track } from "./types";

export interface PathsInfo {
  root: string;
  media_dir: string;
  covers_dir: string;
  lyrics_dir: string;
}

export const api = {
  // Paths
  getPaths: () => invoke<PathsInfo>("get_paths"),

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
  removeFromPlaylist: (playlistId: string, trackId: string) =>
    invoke<void>("remove_from_playlist", { playlistId, trackId }),
  deletePlaylist: (id: string) => invoke<void>("delete_playlist", { id }),
  playlistTracks: (playlistId: string) =>
    invoke<Track[]>("playlist_tracks", { playlistId }),
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
  setDspMode:       (mode: DspMode) => invoke<void>("set_dsp_mode", { mode }),

  // Playlist covers
  setPlaylistCoverUpload: (playlistId: string, imageBytes: Uint8Array) =>
    invoke<string>("set_playlist_cover_upload", { playlistId, imageBytes: Array.from(imageBytes) }),
  setPlaylistCoverCollage: (playlistId: string) =>
    invoke<string>("set_playlist_cover_collage", { playlistId }),

  // Local server / Listen Together
  localServerInfo: () =>
    invoke<{ host: string; port: number; url: string; ws_url: string }>("local_server_info"),
  listenTogetherQr: () => invoke<string>("listen_together_qr"),
};

export function onPosition(cb: (s: PlaybackState) => void): Promise<UnlistenFn> {
  return listen<PlaybackState>("liplay://position", (e) => cb(e.payload));
}

/** Cached app data paths so cover/media URLs resolve synchronously. */
let cachedPaths: PathsInfo | null = null;
export async function ensurePaths(): Promise<PathsInfo> {
  if (!cachedPaths) cachedPaths = await api.getPaths();
  return cachedPaths;
}
export function pathsSync(): PathsInfo | null { return cachedPaths; }

/** Resolve a stored cover/media file name (relative) to a tauri:// asset URL.
 *  `kind` selects which subdir to join. Falls back to convertFileSrc directly
 *  if the input is already absolute. */
export function toAssetUrl(rel: string, kind: "cover" | "media" = "cover"): string {
  if (rel.startsWith("/")) return convertFileSrc(rel);
  const p = pathsSync();
  if (!p) return "";
  const base = kind === "cover" ? p.covers_dir : p.media_dir;
  // Strip the legacy "Covers/" / "Media/" prefix some callers still pass.
  const name = rel.replace(/^(Covers|Media)\//, "");
  const sep = base.endsWith("/") ? "" : "/";
  return convertFileSrc(`${base}${sep}${name}`);
}
