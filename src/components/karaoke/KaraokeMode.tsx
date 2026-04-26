import { AnimatePresence, motion } from "framer-motion";
import { memo, useEffect, useMemo, useState } from "react";
import VinylPlayer from "./VinylPlayer";
import LyricsScroller from "./LyricsScroller";
import { useUi } from "@/stores/uiStore";
import { usePlayer } from "@/stores/playerStore";
import { springStage } from "@/animations/springs";
import { api, toAssetUrl } from "@/lib/tauri";
import { parseLrc } from "@/lib/lrc";
import type { ParsedLrcLine } from "@/lib/types";

/** Kept separate so it can subscribe to position_ms without dragging
 *  the whole karaoke section through a re-render every audio tick. */
const LiveLyrics = memo(function LiveLyrics({ lines }: { lines: ParsedLrcLine[] }) {
  const positionMs = usePlayer((s) => s.position_ms);
  return <LyricsScroller lines={lines} positionMs={positionMs} />;
});

export default function KaraokeMode() {
  const open = useUi((s) => s.karaoke);
  const setKaraoke = useUi((s) => s.setKaraoke);
  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing);
  const [lines, setLines] = useState<ParsedLrcLine[]>([]);

  useEffect(() => {
    if (!current) { setLines([]); return; }
    let cancelled = false;
    (async () => {
      const cached = await api.loadLrc(current.id);
      const payload = cached ?? (await api.fetchLyrics(current.id));
      if (!cancelled && payload?.body) setLines(parseLrc(payload.body));
      else if (!cancelled) setLines([]);
    })();
    return () => { cancelled = true; };
  }, [current?.id]);

  const coverUrl = useMemo(() => {
    if (!current?.cover_path) return null;
    return toAssetUrl(current.cover_path, "cover");
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
            <div className="w-[40%] h-full flex items-center justify-center p-12">
              <VinylPlayer coverUrl={coverUrl} playing={playing} />
            </div>

            <div className="w-[60%] h-full">
              {lines.length > 0 ? (
                <LiveLyrics lines={lines} />
              ) : (
                <div className="h-full flex items-center justify-center text-white/40 text-lg">
                  No lyrics for this track yet.
                </div>
              )}
            </div>

            <button
              onClick={() => setKaraoke(false)}
              className="absolute top-5 right-6 text-white/60 hover:text-white text-sm tracking-wider"
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
