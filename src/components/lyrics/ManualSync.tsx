import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { api } from "@/lib/tauri";
import { usePlayer } from "@/stores/playerStore";
import { serializeLrc } from "@/lib/lrc";
import type { ParsedLrcLine } from "@/lib/types";

interface Props { open: boolean; onClose: () => void; trackId: string; }

/**
 * Manual sync mode:
 *   - User pastes raw lyrics (one line per row).
 *   - Pressing the line button stamps the current playback position into
 *     that row, producing an [mm:ss.cc] prefix.
 *   - Save persists the file to disk and the DB.
 */
export default function ManualSync({ open, onClose, trackId }: Props) {
  const [raw, setRaw] = useState("");
  const [stamps, setStamps] = useState<number[]>([]);
  const position = usePlayer((s) => s.position_ms);

  useEffect(() => { if (open) { setRaw(""); setStamps([]); } }, [open]);

  if (!open) return null;
  const lines = raw.split(/\r?\n/);

  function stamp(i: number) {
    const next = [...stamps];
    next[i] = position;
    setStamps(next);
  }

  async function save() {
    const parsed: ParsedLrcLine[] = lines.map((text, i) => ({
      time: stamps[i] ?? -1,
      text: text.trim(),
    })).filter((l) => l.text.length > 0);
    const body = serializeLrc(parsed);
    await api.saveLrc(trackId, body, parsed.some((l) => l.time >= 0), "manual");
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md flex items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[640px] max-h-[80vh] flex flex-col bg-surface text-text rounded-3xl border border-outline p-6"
      >
        <h3 className="text-lg font-medium mb-3">Manual lyric sync</h3>
        <p className="text-xs text-muted mb-3">
          Paste lyrics, then press the time-stamp button on each line at the moment it's sung.
        </p>

        {raw.length === 0 ? (
          <textarea
            autoFocus
            placeholder="Paste raw lyrics here..."
            onChange={(e) => setRaw(e.target.value)}
            className="flex-1 min-h-[280px] p-3 rounded-xl bg-elevated text-sm outline-none"
          />
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-1">
            {lines.map((text, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-elevated">
                <button
                  onClick={() => stamp(i)}
                  className="text-[11px] tabular-nums w-20 px-2 py-1 rounded-md bg-elevated text-muted hover:text-text"
                >
                  {stamps[i] != null ? fmt(stamps[i]) : "stamp"}
                </button>
                <span className="text-sm flex-1 truncate">{text || " "}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-outline">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted hover:text-text">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={raw.length === 0}
            className="px-4 py-2 rounded-xl bg-text text-bg text-sm font-medium disabled:opacity-50"
          >
            Save .lrc
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function fmt(ms: number) {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const sec = Math.floor(totalSec % 60).toString().padStart(2, "0");
  const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, "0");
  return `${min}:${sec}.${cs}`;
}
