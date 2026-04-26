import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { EQ_LABELS, useDsp } from "@/stores/dspStore";
import { springStage } from "@/animations/springs";

interface Props { open: boolean; onClose: () => void; }

/** Pointer-driven vertical slider. The native <input type="range"> doesn't
 *  reliably accept the writing-mode hack across Chromium versions, which is
 *  why the previous EQ wouldn't move at all. */
function VSlider({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function calc(clientY: number): number {
    if (!ref.current) return value;
    const r = ref.current.getBoundingClientRect();
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    let v = min + (max - min) * ratio;
    v = Math.round(v / step) * step;
    return Math.max(min, Math.min(max, v));
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (dragging.current) onChange(calc(e.clientY)); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [min, max, step]);

  // 0 dB lives at the vertical center; both fill directions look correct.
  const span = max - min;
  const valuePct = ((value - min) / span) * 100;
  const zeroPct  = ((0 - min) / span) * 100;
  const fromPct  = Math.min(valuePct, zeroPct);
  const toPct    = Math.max(valuePct, zeroPct);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        onChange(calc(e.clientY));
      }}
      onDoubleClick={() => onChange(0)}
      className="relative h-full w-3 mx-auto bg-elevated rounded-full cursor-pointer touch-none"
    >
      <div
        className="absolute left-0 right-0 bg-accent rounded-full"
        style={{ bottom: `${fromPct}%`, top: `${100 - toPct}%` }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2
                   w-4 h-4 rounded-full bg-accent ring-2 ring-surface shadow-sm"
        style={{ top: `${100 - valuePct}%` }}
      />
    </div>
  );
}

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
            className="w-[700px] mb-24 bg-surface text-text rounded-3xl border border-outline p-6 shadow-2xl"
          >
            <header className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-medium">Equalizer</h3>
              <button onClick={resetEq} className="text-xs text-muted hover:text-text">Reset</button>
            </header>

            <div className="grid grid-cols-10 gap-3 h-56">
              {gainsDb.map((g, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="flex-1 w-full">
                    <VSlider
                      value={g}
                      min={-12} max={12} step={0.5}
                      onChange={(v) => setBand(i, v)}
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

            <p className="mt-3 text-[11px] text-muted">
              Drag a band; double-click to reset that band to 0 dB.
            </p>

            <div className="grid grid-cols-2 gap-6 mt-5 pt-5 border-t border-outline">
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
