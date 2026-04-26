import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

import { api, toAssetUrl } from "@/lib/tauri";
import { errMsg } from "@/lib/errors";
import { useLibrary } from "@/stores/libraryStore";
import { springStage } from "@/animations/springs";

interface Props { open: boolean; onClose: () => void; playlistId: string; }

export default function PlaylistCoverEdit({ open, onClose, playlistId }: Props) {
  const refresh = useLibrary((s) => s.refreshPlaylists);
  const playlists = useLibrary((s) => s.playlists);
  const playlist = playlists.find((p) => p.id === playlistId);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bump, setBump] = useState(0); // cache-buster after a successful update

  async function pickAndUpload() {
    const path = await openDialog({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg"] }],
    });
    if (typeof path !== "string") return;
    setBusy(true); setHint(null);
    try {
      const bytes = await readFile(path);
      await api.setPlaylistCoverUpload(playlistId, bytes);
      await refresh();
      setBump((b) => b + 1);
      setHint("Cover saved");
    } catch (e) { setHint(`Failed: ${errMsg(e)}`); }
    finally { setBusy(false); }
  }

  async function generateCollage() {
    setBusy(true); setHint(null);
    try {
      await api.setPlaylistCoverCollage(playlistId);
      await refresh();
      setBump((b) => b + 1);
      setHint("Collage generated");
    } catch (e) { setHint(`Failed: ${errMsg(e)}`); }
    finally { setBusy(false); }
  }

  const cover = playlist?.cover_path
    ? `${toAssetUrl(playlist.cover_path, "cover")}?v=${bump}`
    : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm flex items-center justify-center"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={springStage}
            onClick={(e) => e.stopPropagation()}
            className="w-[460px] bg-surface text-text rounded-3xl border border-outline p-5 shadow-2xl"
          >
            <h3 className="text-lg font-medium mb-3">Playlist cover</h3>

            <div className="aspect-square w-full rounded-2xl bg-elevated overflow-hidden mb-4">
              {cover && <img src={cover} className="w-full h-full object-cover" alt="" />}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={pickAndUpload}
                disabled={busy}
                className="py-2 rounded-xl bg-text text-bg text-sm font-medium disabled:opacity-50"
              >
                Upload image
              </button>
              <button
                onClick={generateCollage}
                disabled={busy}
                className="py-2 rounded-xl border border-outline text-text text-sm hover:bg-elevated disabled:opacity-50"
              >
                Generate 2x2 collage
              </button>
            </div>
            {hint && <div className="mt-3 text-xs text-muted">{hint}</div>}

            <div className="mt-4 pt-4 border-t border-outline flex justify-end">
              <button onClick={onClose} className="text-sm text-muted hover:text-text">Close</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
