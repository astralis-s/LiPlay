import { motion } from "framer-motion";
import { springGlide } from "@/animations/springs";
import { useUi } from "@/stores/uiStore";
import Library from "@/components/library/Library";
import MonthlyRecap from "@/components/recap/MonthlyRecap";
import { useLibrary } from "@/stores/libraryStore";
import { usePlayer } from "@/stores/playerStore";
import { useEffect } from "react";
import { toAssetUrl } from "@/lib/tauri";

export default function CenterView() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const { tracks, refreshTracks } = useLibrary();
  const { playTrack, setQueue } = usePlayer();

  useEffect(() => { refreshTracks(); }, []);

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springGlide}
      className="flex-1 h-full overflow-y-auto px-10 py-8"
    >
      {view === "library" ? (
        <Library />
      ) : (
        <>
          <h1 className="text-3xl font-medium tracking-tight text-text">Home</h1>
          <p className="mt-1 text-muted">Recently added</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
            {tracks.slice(0, 10).map((t, i) => {
              const cover = t.cover_path ? toAssetUrl(`Covers/${t.cover_path}`) : null;
              return (
                <motion.button
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, ...springGlide }}
                  onClick={() => { setQueue(tracks); playTrack(t); }}
                  className="text-left group"
                >
                  <div className="aspect-square rounded-2xl overflow-hidden bg-elevated mb-2">
                    {cover && <img src={cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                  </div>
                  <div className="text-sm text-text truncate">{t.title}</div>
                  <div className="text-xs text-muted truncate">{t.artist}</div>
                </motion.button>
              );
            })}
          </div>

          {tracks.length === 0 && (
            <div className="mt-12 p-10 rounded-2xl border border-outline text-center">
              <p className="text-muted">Nothing yet.</p>
              <button
                onClick={() => setView("library")}
                className="mt-3 px-4 py-2 rounded-xl bg-text text-bg text-sm font-medium"
              >
                Go to Library to import files
              </button>
            </div>
          )}

          <MonthlyRecap />
        </>
      )}
    </motion.main>
  );
}
