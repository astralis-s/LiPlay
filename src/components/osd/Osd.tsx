import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import { api, ensurePaths, toAssetUrl } from "@/lib/tauri";
import type { Track } from "@/lib/types";
import { springStage } from "@/animations/springs";

/** Cinematic OSD window. Renders nothing while idle and slides in for ~4s
 *  whenever the host emits `liplay://track-changed`. */
export default function Osd() {
  const [track, setTrack] = useState<Track | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    ensurePaths().catch(() => {});

    const unlisten = listen<string>("liplay://track-changed", async (e) => {
      const id = e.payload;
      const tracks = await api.listTracks().catch(() => [] as Track[]);
      const t = tracks.find((tr) => tr.id === id) ?? null;
      if (cancelled) return;
      setTrack(t);
      setVisible(true);
      const win = getCurrentWebviewWindow();
      win.show().catch(() => {});

      if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        setVisible(false);
        // Hide the window itself after the exit animation finishes.
        window.setTimeout(() => { getCurrentWebviewWindow().hide().catch(() => {}); }, 600);
      }, 4000);
    });

    return () => {
      cancelled = true;
      unlisten.then((fn) => fn()).catch(() => {});
      if (hideTimer.current != null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  const cover = track?.cover_path ? toAssetUrl(track.cover_path, "cover") : null;

  return (
    <div className="w-screen h-screen overflow-hidden bg-transparent">
      <AnimatePresence>
        {visible && track && (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, x: -24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0,    scale: 1.0  }}
            exit={{    opacity: 0, x: -24, scale: 0.94 }}
            transition={springStage}
            className="m-3 flex items-center gap-3 px-3 py-3 rounded-2xl
                       bg-[rgba(10,10,12,0.86)] backdrop-blur-2xl border border-white/10 shadow-2xl"
          >
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/10 shrink-0">
              {cover && <img src={cover} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-white/60">
                Now playing
              </div>
              <div className="text-base font-semibold text-white truncate max-w-[260px]">
                {track.title}
              </div>
              <div className="text-xs text-white/70 truncate max-w-[260px]">
                {track.artist}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
