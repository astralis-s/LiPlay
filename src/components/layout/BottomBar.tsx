import { useState } from "react";
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
import { api, toAssetUrl } from "@/lib/tauri";
import ManualSync from "@/components/lyrics/ManualSync";

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function BottomBar() {
  const { current, playing, position_ms, duration_ms, volume, toggle, next, prev } = usePlayer();
  const setKaraoke = useUi((s) => s.setKaraoke);
  const toggleRight = useUi((s) => s.toggleRight);
  const [syncOpen, setSyncOpen] = useState(false);

  const pct = duration_ms > 0 ? (position_ms / duration_ms) * 100 : 0;
  const cover = current?.cover_path ? toAssetUrl(`Covers/${current.cover_path}`) : null;

  function onScrub(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration_ms) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    api.seek(Math.floor(ratio * duration_ms));
  }

  return (
    <>
      <footer className="relative h-20 border-t border-outline bg-surface">
        {/* Progress bar at the very top edge of the bar. */}
        <div
          onClick={onScrub}
          className="absolute top-0 left-0 right-0 h-[3px] bg-elevated cursor-pointer group"
        >
          <motion.div
            className="h-full bg-accent group-hover:h-[5px] transition-all"
            style={{ width: `${pct}%` }}
            transition={{ duration: 0.1, ease: "linear" }}
          />
        </div>

        <div className="h-full px-5 flex items-center gap-5">
          <button
            onClick={toggleRight}
            className="flex items-center gap-3 w-[260px] min-w-0 hover:bg-elevated/60 rounded-xl px-2 py-1 -ml-2"
          >
            <div className="w-12 h-12 rounded-lg bg-elevated overflow-hidden shrink-0">
              {cover && <img src={cover} className="w-full h-full object-cover" alt="" />}
            </div>
            <div className="min-w-0 text-left">
              <div className="text-sm font-medium truncate text-text">
                {current?.title ?? "Nothing playing"}
              </div>
              <div className="text-xs truncate text-muted">{current?.artist ?? ""}</div>
            </div>
          </button>

          <div className="flex-1 flex items-center justify-center gap-3">
            <button onClick={prev} className="p-2 text-muted hover:text-text"><IconSkipPrev /></button>
            <button
              onClick={toggle}
              className="p-3 rounded-full bg-text text-bg hover:opacity-90"
            >
              {playing ? <IconPause /> : <IconPlay />}
            </button>
            <button onClick={next} className="p-2 text-muted hover:text-text"><IconSkipNext /></button>
            <span className="ml-3 text-[11px] text-muted tabular-nums">
              {fmt(position_ms)} / {fmt(duration_ms)}
            </span>
          </div>

          <div className="w-[260px] flex items-center justify-end gap-3">
            {current && (
              <button
                onClick={() => setSyncOpen(true)}
                title="Manual lyric sync"
                className="px-2 py-1 rounded-lg text-[11px] tracking-wider text-muted hover:text-text hover:bg-elevated"
              >
                LRC
              </button>
            )}
            <input
              type="range" min={0} max={100} value={Math.round(volume * 100)}
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

      {current && (
        <ManualSync
          open={syncOpen}
          onClose={() => setSyncOpen(false)}
          trackId={current.id}
        />
      )}
    </>
  );
}
