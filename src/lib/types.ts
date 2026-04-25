export interface Track {
  id: string;
  file_name: string;
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
  cover_path: string | null;
  play_count: number;
  added_at: string;
}

export interface Playlist {
  id: string;
  name: string;
  created_at: string;
}

export interface PlaybackState {
  track_id: string | null;
  position_ms: number;
  duration_ms: number;
  playing: boolean;
  volume: number;
}

export interface LyricsPayload {
  synced: boolean;
  body: string;
  source: string;
}

export interface ParsedLrcLine {
  /** ms; -1 means unsynced. */
  time: number;
  text: string;
}
