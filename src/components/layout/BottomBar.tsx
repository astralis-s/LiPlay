import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  IconKaraoke,
  IconPause,
  IconPlay,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconSkipNext,
  IconSkipPrev,
} from "@/components/icons/Icons";
import { usePlayer } from "@/stores/playerStore";
import { useUi } from "@/stores/uiStore";
import { api, toAssetUrl } from "@/lib/tauri";

function fmt(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function BottomBar() {
  const {
    current, playing, position_ms, duration_ms, volume,
    repeat, shuffle, toggle, next, prev, cycleRepeat, toggleShuffle,
  } = usePlayer();
  const setKaraoke = useUi((s) => s.setKaraoke);
  const toggleRight = useUi((s) => s.toggleRight);

  // Drag-to-seek with optimistic local position so the thumb tracks the
  // cursor without round-tripping through the audio engine on every event.
  const seekRef = useRef<HTMLDivElement>(null);
  const [dragMs, setDragMs] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const displayMs = dragMs ?? position_ms;
  const pct = duration_ms > 0 ? (displayMs / duration_ms) * 100 : 0;
  const cover = current?.cover_path ? toAssetUrl(current.cover_path, "cover") : null;

  function msAt(clientX: number): number {
    if (!seekRef.current || !duration_ms) return 0;
    const r = seekRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.floor(ratio * duration_ms);
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      setDragMs(msAt(e.clientX));
    };
    const onUp = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const final = msAt(e.clientX);
      draggingRef.current = false;
      api.seek(final).finally(() => setDragMs(null));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
    };
  }, [duration_ms]);

  const repeatActive = repeat !== "off";

  return (
    <footer className="relative h-20 border-t border-outline bg-surface">
      {/* Wider hit-zone, thin visible bar. The whole 12-px strip is draggable. */}
      <div
        ref={seekRef}
        onPointerDown={(e) => {
          if (!duration_ms) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          draggingRef.current = true;
          setDragMs(msAt(e.clientX));
        }}
        className="absolute -top-2 left-0 right-0 h-3 cursor-pointer group"
      >
        <div className="absolute top-2 left-0 right-0 h-[3px] bg-elevated group-hover:h-[5px] transition-all rounded-full" />
        <motion.div
          className="absolute top-2 left-0 h-[3px] bg-accent group-hover:h-[5px] transition-all rounded-full"
          style={{ width: `${pct}%` }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent
                     opacity-0 group-hover:opacity-100 transition-opacity ring-2 ring-surface"
          style={{ left: `${pct}%` }}
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

        <div className="flex-1 flex items-center justify-center gap-1">
          <button
            onClick={toggleShuffle}
            className={["p-2 rounded-lg hover:bg-elevated", shuffle ? "text-accent" : "text-muted hover:text-text"].join(" ")}
            title="Shuffle"
          >
            <IconShuffle />
          </button>
          <button onClick={prev} className="p-2 text-text hover:bg-elevated rounded-lg"><IconSkipPrev /></button>
          <button
            onClick={toggle}
            className="mx-1 p-3 rounded-full bg-text text-bg hover:opacity-90"
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button onClick={next} className="p-2 text-text hover:bg-elevated rounded-lg"><IconSkipNext /></button>
          <button
            onClick={cycleRepeat}
            className={["p-2 rounded-lg hover:bg-elevated", repeatActive ? "text-accent" : "text-muted hover:text-text"].join(" ")}
            title={`Repeat: ${repeat}`}
          >
            {repeat === "one" ? <IconRepeatOne /> : <IconRepeat />}
          </button>
          <span className="ml-3 text-[11px] text-muted tabular-nums select-none">
            {fmt(displayMs)} / {fmt(duration_ms)}
          </span>
        </div>

        <div className="w-[260px] flex items-center justify-end gap-3">
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
  );
}
