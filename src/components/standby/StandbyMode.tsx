import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useFft } from "@/hooks/useFft";
import { usePlayer } from "@/stores/playerStore";
import { toAssetUrl } from "@/lib/tauri";

interface Props { active: boolean; }

/** Fullscreen screensaver. Shown when the user is idle and music is playing.
 *  - Background: large blurred + darkened cover.
 *  - Center: crisp cover.
 *  - Right of cover: huge clock + track meta.
 *  - Bottom: minimalist FFT spectrum line. */
export default function StandbyMode({ active }: Props) {
  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing);
  const bins = useFft();
  const cover = current?.cover_path ? toAssetUrl(current.cover_path, "cover") : null;

  const visible = active && playing && current != null;
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    setNow(new Date());
    return () => window.clearInterval(id);
  }, [visible]);

  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="standby"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[60] overflow-hidden bg-black"
        >
          {cover && (
            <img
              src={cover}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-110
                         blur-[64px] brightness-[0.35] saturate-150"
              draggable={false}
            />
          )}

          <div className="absolute inset-0 flex items-center justify-center gap-16 px-24">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1.0,  opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="w-[42vh] h-[42vh] rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-2xl"
            >
              {cover && <img src={cover} className="w-full h-full object-cover" alt="" />}
            </motion.div>

            <div className="text-white">
              <div className="font-semibold tracking-tight tabular-nums"
                   style={{ fontSize: "12rem", lineHeight: 1, letterSpacing: "-0.05em" }}>
                {hh}:{mm}
              </div>
              <div className="mt-6 text-3xl font-semibold tracking-tight max-w-[40ch] truncate">
                {current?.title}
              </div>
              <div className="mt-1 text-xl text-white/70 max-w-[40ch] truncate">
                {current?.artist}
              </div>
            </div>
          </div>

          {/* Spectrum line */}
          <div className="absolute left-0 right-0 bottom-0 px-12 pb-10 flex items-end justify-center gap-[3px] h-24">
            {bins.map((v, i) => (
              <div
                key={i}
                className="flex-1 max-w-[8px] rounded-t bg-white/85"
                style={{ height: `${Math.max(2, v * 100)}%` }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
