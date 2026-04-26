import { useEffect } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { motion } from "framer-motion";

import { useLibrary } from "@/stores/libraryStore";
import { usePlayer } from "@/stores/playerStore";
import TrackRow from "./TrackRow";
import { springGlide } from "@/animations/springs";

export default function Library() {
  const { tracks, refreshTracks, importFromPaths, loading } = useLibrary();
  const { current, playTrack, setQueue } = usePlayer();

  useEffect(() => { refreshTracks(); }, []);

  async function pickAndImport() {
    const selected = await openDialog({
      multiple: true,
      filters: [
        { name: "Audio", extensions: ["mp3", "flac", "wav", "m4a", "ogg", "opus"] },
      ],
    });
    const paths = (Array.isArray(selected) ? selected : selected ? [selected] : []) as string[];
    if (paths.length) await importFromPaths(paths);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springGlide}
    >
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-medium tracking-tight text-text">Library</h1>
        <button
          onClick={pickAndImport}
          className="px-4 py-2 rounded-xl bg-text text-bg text-sm font-medium hover:opacity-90"
        >
          Import files
        </button>
      </header>

      {tracks.length === 0 && !loading && (
        <div className="py-20 text-center text-muted">
          Nothing here yet. Click <span className="text-text">Import files</span> to add MP3, FLAC or WAV.
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
          />
        ))}
      </div>
    </motion.section>
  );
}
