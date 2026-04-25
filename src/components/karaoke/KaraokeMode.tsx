import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import VinylPlayer from "./VinylPlayer";
import LyricsScroller from "./LyricsScroller";
import { useUi } from "@/stores/uiStore";
import { usePlayer } from "@/stores/playerStore";
import { springStage } from "@/animations/springs";
import { api, toAssetUrl } from "@/lib/tauri";
import { parseLrc } from "@/lib/lrc";
import type { ParsedLrcLine } from "@/lib/types";

/**
 * Triggered from the bottom bar. Expands with a seamless layout animation
 * (Framer's `layoutId` carries the mini-cover into the vinyl label).
 */
export default function KaraokeMode() {
  const open = useUi((s) => s.karaoke);
  const setKaraoke = useUi((s) => s.setKaraoke);
  const { current, playing, position_ms } = usePlayer();
  const [lines, setLines] = useState<ParsedLrcLine[]>([]);

  useEffect(() => {
    if (!current) { setLines([]); return; }
    let cancelled = false;
    (async () => {
      const cached = await api.loadLrc(current.id);
      const payload = cached ?? (await api.fetchLyrics(current.id));
      if (!cancelled && payload?.body) setLines(parseLrc(payload.body));
    })();
    return () => { cancelled = true; };
  }, [current?.id]);

  const coverUrl = useMemo(() => {
    if (!current?.cover_path) return null;
    // Covers live in ~/.local/share/LiPlay/Covers/<file>.
    // The Rust side returns just the file name; resolve via the asset protocol.
    return toAssetUrl(`Covers/${current.cover_path}`);
  }, [current?.cover_path]);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          key="karaoke"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-40 bg-[rgb(8,8,10)]"
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={springStage}
            className="h-full w-full flex"
          >
            {/* Left 40% : vinyl */}
            <div className="w-[40%] h-full flex items-center justify-center p-12">
              <VinylPlayer coverUrl={coverUrl} playing={playing} />
            </div>

            {/* Right 60% : lyrics */}
            <div className="w-[60%] h-full">
              <LyricsScroller lines={lines} positionMs={position_ms} />
            </div>

            {/* Close affordance */}
            <button
              onClick={() => setKaraoke(false)}
              className="absolute top-5 right-6 text-white/60 hover:text-white text-sm tracking-wide"
              aria-label="Exit karaoke"
            >
              CLOSE
            </button>
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
