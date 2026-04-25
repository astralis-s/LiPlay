import { motion } from "framer-motion";
import {
  IconKaraoke,
  IconPause,
  IconPlay,
  IconSkipNext,
  IconSkipPrev,
} from "@/components/icons/Icons";
import { usePlayer } from "@/stores/playerStore";
import { useUi } from "@/stores/uiStore";
import { api } from "@/lib/tauri";

export default function BottomBar() {
  const { current, playing, position_ms, duration_ms, volume, toggle, next, prev } = usePlayer();
  const setKaraoke = useUi((s) => s.setKaraoke);

  const pct = duration_ms > 0 ? (position_ms / duration_ms) * 100 : 0;

  return (
    <footer className="relative h-20 border-t border-outline bg-surface">
      {/* Progress bar at the very top edge of the bar. */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-elevated">
        <motion.div
          className="h-full bg-accent"
          style={{ width: `${pct}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>

      <div className="h-full px-5 flex items-center gap-5">
        {/* Mini cover + meta */}
        <div className="flex items-center gap-3 w-[260px] min-w-0">
          <div className="w-12 h-12 rounded-lg bg-elevated overflow-hidden shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate text-text">
              {current?.title ?? ""}
            </div>
            <div className="text-xs truncate text-muted">{current?.artist ?? ""}</div>
          </div>
        </div>

        {/* Transport */}
        <div className="flex-1 flex items-center justify-center gap-3">
          <button onClick={prev} className="p-2 text-muted hover:text-text">
            <IconSkipPrev />
          </button>
          <button
            onClick={toggle}
            className="p-3 rounded-full bg-text text-bg hover:opacity-90"
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button onClick={next} className="p-2 text-muted hover:text-text">
            <IconSkipNext />
          </button>
        </div>

        {/* Volume + karaoke toggle */}
        <div className="w-[260px] flex items-center justify-end gap-3">
          <input
            type="range"
            min={0} max={100} value={Math.round(volume * 100)}
            onChange={(e) => api.setVol(Number(e.target.value) / 100)}
            className="w-28 accent-[rgb(var(--accent))]"
          />
          <button
            onClick={() => setKaraoke(true)}
            className="p-2 rounded-lg text-muted hover:text-text hover:bg-elevated"
            aria-label="Open karaoke"
          >
            <IconKaraoke />
          </button>
        </div>
      </div>
    </footer>
  );
}
