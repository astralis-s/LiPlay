import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { api } from "@/lib/tauri";
import { springGlide } from "@/animations/springs";

interface RecapEntry {
  track_id: string;
  title: string;
  artist: string;
  plays: number;
}

function thisYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

export default function MonthlyRecap() {
  const [entries, setEntries] = useState<RecapEntry[]>([]);
  const [ym] = useState(thisYearMonth());

  useEffect(() => {
    api.monthlyRecap(ym).then(setEntries).catch(() => setEntries([]));
  }, [ym]);

  if (entries.length === 0) return null;

  const max = Math.max(...entries.map((e) => e.plays), 1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springGlide}
      className="mt-12"
    >
      <header className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-text">Monthly recap</h2>
          <p className="text-sm text-muted">Top tracks for {ym}</p>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        {entries.map((e, i) => (
          <motion.div
            key={e.track_id}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02, ...springGlide }}
            className="grid grid-cols-[24px_1fr_140px_56px] items-center gap-4 px-3 py-2 rounded-xl hover:bg-elevated"
          >
            <div className="text-xs text-muted tabular-nums">
              {(i + 1).toString().padStart(2, "0")}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-text truncate">{e.title}</div>
              <div className="text-xs text-muted truncate">{e.artist}</div>
            </div>
            <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
              <div
                className="h-full bg-accent"
                style={{ width: `${(e.plays / max) * 100}%` }}
              />
            </div>
            <div className="text-xs text-muted text-right tabular-nums">
              {e.plays} {e.plays === 1 ? "play" : "plays"}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
