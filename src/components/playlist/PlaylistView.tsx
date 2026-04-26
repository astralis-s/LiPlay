import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { api, toAssetUrl } from "@/lib/tauri";
import { useLibrary } from "@/stores/libraryStore";
import { usePlayer } from "@/stores/playerStore";
import TrackRow from "@/components/library/TrackRow";
import PlaylistCoverEdit from "@/components/playlist/PlaylistCoverEdit";
import { springGlide } from "@/animations/springs";
import type { Track } from "@/lib/types";

interface Props { playlistId: string; }

export default function PlaylistView({ playlistId }: Props) {
  const playlists = useLibrary((s) => s.playlists);
  const playlist = playlists.find((p) => p.id === playlistId);
  const { current, playTrack, setQueue } = usePlayer();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [editCover, setEditCover] = useState(false);

  async function reload() {
    const list = await api.playlistTracks(playlistId);
    setTracks(list);
  }
  useEffect(() => { reload(); }, [playlistId]);

  const cover = playlist?.cover_path ? toAssetUrl(playlist.cover_path, "cover") : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springGlide}
    >
      <header className="mb-6 flex items-end gap-6">
        <button
          onClick={() => setEditCover(true)}
          className="w-44 h-44 rounded-2xl bg-elevated overflow-hidden shrink-0 hover:ring-2 hover:ring-accent transition"
          title="Edit cover"
        >
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-xs">
              Cover
            </div>
          )}
        </button>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-muted">Playlist</p>
          <h1 className="text-3xl font-medium tracking-tight text-text">
            {playlist?.name ?? ""}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
          </p>
          {tracks.length > 0 && (
            <button
              onClick={() => { setQueue(tracks); playTrack(tracks[0]); }}
              className="mt-4 px-4 py-2 rounded-xl bg-text text-bg text-sm font-medium hover:opacity-90"
            >
              Play
            </button>
          )}
        </div>
      </header>

      <PlaylistCoverEdit
        open={editCover}
        onClose={() => setEditCover(false)}
        playlistId={playlistId}
      />

      {tracks.length === 0 && (
        <div className="py-16 text-center text-muted">
          Empty playlist. Right-click any track in the library and choose
          <span className="text-text"> Add to playlist</span>.
        </div>
      )}

      <div className="flex flex-col gap-1">
        {tracks.map((t, i) => (
          <TrackRow
            key={t.id}
            track={t}
            index={i}
            active={current?.id === t.id}
            onPlay={(tr) => { setQueue(tracks); playTrack(tr); }}
            inPlaylistId={playlistId}
            onChanged={reload}
          />
        ))}
      </div>
    </motion.section>
  );
}
