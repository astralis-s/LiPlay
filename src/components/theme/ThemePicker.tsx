import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/stores/themeStore";
import { usePlayer } from "@/stores/playerStore";
import { toAssetUrl } from "@/lib/tauri";
import type { ThemeId } from "@/theme/themes";
import { springStage } from "@/animations/springs";

const THEMES: { id: ThemeId; label: string; sub: string }[] = [
  { id: "clean-light",    label: "Clean Light",    sub: "Default minimal palette" },
  { id: "deep-dark",      label: "Deep Dark",      sub: "OLED-friendly" },
  { id: "light-accent",   label: "Light + Accent", sub: "Custom accent color" },
  { id: "dark-accent",    label: "Dark + Accent",  sub: "Custom accent on dark" },
  { id: "adaptive-light", label: "Adaptive Light", sub: "From the album cover" },
  { id: "adaptive-dark",  label: "Adaptive Dark",  sub: "From the album cover" },
];

interface Props { open: boolean; onClose: () => void; }

export default function ThemePicker({ open, onClose }: Props) {
  const { id, setTheme, customAccent, setCustomAccent, refreshAdaptive } = useTheme();
  const current = usePlayer((s) => s.current);

  async function pick(next: ThemeId) {
    setTheme(next);
    if ((next === "adaptive-light" || next === "adaptive-dark") && current?.cover_path) {
      await refreshAdaptive(toAssetUrl(current.cover_path, "cover"));
    }
  }

  const accentHex = customAccent
    ? "#" + customAccent.map((c) => c.toString(16).padStart(2, "0")).join("")
    : "#5856d6";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="themepicker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={springStage}
            onClick={(e) => e.stopPropagation()}
            className="w-[440px] bg-surface text-text rounded-3xl border border-outline p-5 shadow-2xl"
          >
            <h3 className="text-lg font-medium mb-3">Theme</h3>
            <div className="flex flex-col gap-1">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pick(t.id)}
                  className={[
                    "flex items-center justify-between px-3 py-3 rounded-xl text-left",
                    id === t.id ? "bg-elevated" : "hover:bg-elevated/60",
                  ].join(" ")}
                >
                  <div>
                    <div className="text-sm">{t.label}</div>
                    <div className="text-xs text-muted">{t.sub}</div>
                  </div>
                  {id === t.id && <span className="text-xs text-accent">Active</span>}
                </button>
              ))}
            </div>

            {(id === "light-accent" || id === "dark-accent") && (
              <label className="flex items-center justify-between mt-4 pt-4 border-t border-outline">
                <span className="text-sm">Accent color</span>
                <input
                  type="color"
                  value={accentHex}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomAccent([
                      parseInt(v.slice(1, 3), 16),
                      parseInt(v.slice(3, 5), 16),
                      parseInt(v.slice(5, 7), 16),
                    ]);
                  }}
                  className="w-10 h-10 rounded-lg border border-outline bg-transparent cursor-pointer"
                />
              </label>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
