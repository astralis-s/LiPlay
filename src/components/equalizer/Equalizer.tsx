import { motion, AnimatePresence } from "framer-motion";
import { EQ_LABELS, useDsp } from "@/stores/dspStore";
import { springStage } from "@/animations/springs";

interface Props { open: boolean; onClose: () => void; }

export default function Equalizer({ open, onClose }: Props) {
  const { gainsDb, setBand, resetEq, crossfadeMs, setCrossfade, normalize, setNormalize } = useDsp();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="eq"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={springStage}
            onClick={(e) => e.stopPropagation()}
            className="w-[680px] mb-24 bg-surface text-text rounded-3xl border border-outline p-6 shadow-2xl"
          >
            <header className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-medium">Equalizer</h3>
              <button onClick={resetEq} className="text-xs text-muted hover:text-text">Reset</button>
            </header>

            <div className="grid grid-cols-10 gap-3 h-48">
              {gainsDb.map((g, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="flex-1 flex items-end">
                    <input
                      type="range"
                      min={-12} max={12} step={0.5} value={g}
                      onChange={(e) => setBand(i, parseFloat(e.target.value))}
                      className="appearance-none w-2 h-full bg-elevated rounded-full
                                 [writing-mode:bt-lr] accent-[rgb(var(--accent))]"
                      style={{ writingMode: "vertical-lr" as any, transform: "rotate(180deg)" }}
                    />
                  </div>
                  <div className="text-[10px] text-muted tabular-nums">
                    {g > 0 ? `+${g.toFixed(1)}` : g.toFixed(1)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted">
                    {EQ_LABELS[i]}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6 mt-6 pt-5 border-t border-outline">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wider text-muted">
                  Crossfade {crossfadeMs > 0 ? `${crossfadeMs / 1000}s` : "off"}
                </span>
                <input
                  type="range" min={0} max={12000} step={500}
                  value={crossfadeMs}
                  onChange={(e) => setCrossfade(parseInt(e.target.value, 10))}
                  className="accent-[rgb(var(--accent))]"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted">
                  Volume normalization
                </span>
                <input
                  type="checkbox" checked={normalize}
                  onChange={(e) => setNormalize(e.target.checked)}
                />
              </label>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
