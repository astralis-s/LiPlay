import { motion } from "framer-motion";
import { toAssetUrl } from "@/lib/tauri";
import { usePlayer } from "@/stores/playerStore";
import type { Track } from "@/lib/types";

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

interface Props {
  track: Track;
  index: number;
  active: boolean;
  onPlay: (t: Track) => void;
}

export default function TrackRow({ track, index, active, onPlay }: Props) {
  const cover = track.cover_path ? toAssetUrl(track.cover_path, "cover") : null;
  const setCurrent = usePlayer((s) => s.setCurrent);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: index * 0.012 }}
      onDoubleClick={() => onPlay(track)}
      onClick={() => setCurrent(track)}
      className={[
        "grid grid-cols-[40px_56px_1fr_1fr_80px] items-center gap-4 px-3 py-2 rounded-xl cursor-pointer",
        active ? "bg-elevated" : "hover:bg-elevated/60",
      ].join(" ")}
    >
      <div className="text-xs text-muted tabular-nums">{(index + 1).toString().padStart(2, "0")}</div>
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-elevated">
        {cover && <img src={cover} alt="" className="w-full h-full object-cover" draggable={false} />}
      </div>
      <div className="min-w-0">
        <div className={["text-sm truncate", active ? "text-accent" : "text-text"].join(" ")}>
          {track.title}
        </div>
        <div className="text-xs text-muted truncate">{track.artist}</div>
      </div>
      <div className="text-sm text-muted truncate">{track.album}</div>
      <div className="text-xs text-muted text-right tabular-nums">{fmt(track.duration_ms)}</div>
    </motion.div>
  );
}
